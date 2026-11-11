// Meeting and suggestion queries. RLS limits reads to the user's boards and approvals to staff; the
// board filter here only keeps a platform admin's view to one board. No transcript text is loaded until
// the transcript panel asks for one meeting (loadTranscript), so this module stays small enough for the
// main bundle.
import { FunctionsHttpError } from "@supabase/supabase-js";
import { db } from "../../db";
import { fromRow, type TicketRow } from "../tickets/rows";
import type { Ticket } from "../tickets/types";
import type { MeetingInfo, Suggestion, SuggestionChanges } from "./types";

/** "Environmental Protection Committee Meeting", "2026-10-08" -> "Environmental Protection 10/8" */
export function meetingLabel(title: string, heldOn: string): string {
  const name = title.replace(/\s+Committee\b/i, "").replace(/\s+Meeting\b/i, "").trim() || title;
  const [, month, day] = heldOn.split("-").map(Number);
  return `${name} ${month}/${day}`;
}

/** The board's meetings, newest first. */
export async function loadMeetings(board: string): Promise<MeetingInfo[]> {
  const { data, error } = await db
    .from("meetings")
    .select("id, title, held_on, matched_at, committee, folder, minutes_generated_at, minutes_edited_at")
    .eq("board", board)
    .order("held_on", { ascending: false })
    .order("title");
  if (error) throw error;
  return ((data ?? []) as { id: string; title: string; held_on: string; matched_at: string | null; committee: string | null; folder: string; minutes_generated_at: string | null; minutes_edited_at: string | null }[]).map((row) => ({
    id: row.id,
    title: row.title,
    label: meetingLabel(row.title, row.held_on),
    heldOn: row.held_on,
    matchedAt: row.matched_at,
    committee: row.committee,
    folder: row.folder,
    minutesAt: row.minutes_generated_at,
    minutesEditedAt: row.minutes_edited_at,
  }));
}

/** Adds an uploaded transcript as a meeting (staff only; the database checks). Returns the new meeting's id. */
export async function addMeeting(board: string, title: string, heldOn: string, folder: string, transcript: string): Promise<string> {
  const { data, error } = await db.rpc("add_meeting", { b: board, t: title, d: heldOn, f: folder, body: transcript });
  if (error) throw error;
  return data as string;
}

/** Saves the board's pinned Meetings folders, in order (staff only; the database checks). */
export async function setPinnedFolders(board: string, pins: string[]): Promise<void> {
  const { error } = await db.rpc("set_pinned_meeting_folders", { b: board, pins });
  if (error) throw error;
}

/** Renames a meeting (staff only; the database checks). */
export async function renameMeeting(meetingId: string, title: string): Promise<void> {
  const { error } = await db.rpc("rename_meeting", { m: meetingId, t: title });
  if (error) throw readable(error);
}

/** A Supabase error as a real Error, so the message reaches the alert or form that shows it. */
const readable = (error: { message: string }) => new Error(error.message);

/** Adds a folder to the board's Meetings tab (staff only; the database checks). */
export async function addMeetingFolder(board: string, name: string): Promise<void> {
  const { error } = await db.rpc("add_meeting_folder", { b: board, f: name });
  if (error) throw readable(error);
}

/** Moves a meeting to another Meetings folder (staff only; the database checks). */
export async function moveMeeting(meetingId: string, folder: string): Promise<void> {
  const { error } = await db.rpc("move_meeting", { m: meetingId, f: folder });
  if (error) throw readable(error);
}

/** Removes a meeting and its suggestions, and unlinks it from its tickets (staff only; the database checks). */
export async function removeMeeting(meetingId: string): Promise<void> {
  const { error } = await db.rpc("remove_meeting", { m: meetingId });
  if (error) throw readable(error);
}

/** One meeting's transcript text, one paragraph per line. */
export async function loadTranscript(meetingId: string): Promise<string> {
  const { data, error } = await db.from("meetings").select("transcript").eq("id", meetingId).single();
  if (error) throw error;
  return (data as { transcript: string }).transcript;
}

type SuggestionRow = {
  id: string;
  meeting_id: string;
  ticket_id: string | null;
  kind: "update" | "new";
  evidence: string[];
  spans: Suggestion["spans"];
  changes: SuggestionChanges;
  reason: string;
};

/** The board's pending suggestions, oldest first. Decided ones stay in the database as the record. */
export async function loadSuggestions(board: string): Promise<Suggestion[]> {
  const { data, error } = await db
    .from("ticket_suggestions")
    .select("id, meeting_id, ticket_id, kind, evidence, spans, changes, reason")
    .eq("board", board)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as SuggestionRow[]).map((row) => ({
    id: row.id,
    meetingId: row.meeting_id,
    ticketId: row.ticket_id,
    kind: row.kind,
    evidence: row.evidence,
    spans: row.spans,
    changes: row.changes,
    reason: row.reason,
  }));
}

/** One meeting's minutes as HTML, or null before they are drafted. Loaded when the Minutes section opens. */
export async function loadMinutes(meetingId: string): Promise<string | null> {
  const { data, error } = await db.from("meetings").select("minutes_html").eq("id", meetingId).single();
  if (error) throw error;
  return (data as { minutes_html: string | null }).minutes_html;
}

/** Saves staff's edits to the minutes. Only the minutes text changes. */
export async function saveMinutes(meetingId: string, html: string): Promise<void> {
  const { error } = await db.rpc("save_meeting_minutes", { m: meetingId, html });
  if (error) throw error;
}

export type MatchResult = { matched_at: string; updates: number; new: number; dropped: string[] };

/** Runs match-transcript on one meeting. It replaces the meeting's pending suggestions. */
export async function runMatching(meetingId: string): Promise<MatchResult> {
  return invokeMeetingFunction<MatchResult>("match-transcript", meetingId);
}

/** Runs generate-minutes on one meeting. Minutes are drafted once; a second call is refused. */
export async function runMinutes(meetingId: string): Promise<{ minutes_generated_at: string }> {
  return invokeMeetingFunction<{ minutes_generated_at: string }>("generate-minutes", meetingId);
}

async function invokeMeetingFunction<T>(name: string, meetingId: string): Promise<T> {
  const { data, error } = await db.functions.invoke<T>(name, { body: { meeting_id: meetingId } });
  if (error) {
    // The function answers errors as { error: "..." }; show that instead of a generic status message.
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null) as { error?: string } | null;
      if (body?.error) throw new Error(body.error);
    }
    throw error;
  }
  return data!;
}

/** Approves a suggestion, as proposed or with staff's edits. Returns the ticket as saved. */
export async function approveSuggestion(id: string, edited: SuggestionChanges | null): Promise<Ticket> {
  const { data, error } = await db.rpc("apply_ticket_suggestion", { s: id, edited });
  if (error) throw error;
  return fromRow(data as TicketRow);
}

export async function rejectSuggestion(id: string): Promise<void> {
  const { error } = await db.rpc("reject_ticket_suggestion", { s: id });
  if (error) throw error;
}
