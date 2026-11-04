// Meetings and AI suggestions (transcript matching, V2). Rows come from public.meetings and
// public.ticket_suggestions (supabase/migrations/20261103100000_meetings_and_suggestions.sql).
import type { Paragraph } from "../../transcript";
import type { EvidenceSpan } from "../tickets/types";

/** A meeting without its transcript text, for the Transcript column and the meeting picker. */
export type MeetingInfo = {
  id: string;
  title: string;
  /** Short name for the Transcript column's tags, e.g. "Environmental Protection 10/8". */
  label: string;
  /** Meeting date as YYYY-MM-DD. */
  heldOn: string;
  /** When match-transcript last ran on this meeting, or null if it never has. */
  matchedAt: string | null;
};

/** A meeting with its transcript split into paragraphs, as TranscriptView shows it. */
export type TranscriptMeeting = { id: string; title: string; label: string; date: string; paragraphs: Paragraph[] };

/** Ticket fields a suggestion may propose. Names follow the tickets table. */
export const suggestionFields = ["title", "type", "status", "summary", "location_text", "requester", "deadline"] as const;
export type SuggestionField = (typeof suggestionFields)[number];
export type SuggestionChanges = Partial<Record<SuggestionField, string>>;

/** A pending suggestion from match-transcript: an update to an existing ticket, or a new ticket. */
export type Suggestion = {
  id: string;
  meetingId: string;
  /** The ticket to update; null for a new ticket. */
  ticketId: string | null;
  kind: "update" | "new";
  /** Paragraph ids the model cited, e.g. ["P12", "P14"]. */
  evidence: string[];
  /** The same paragraphs as highlights in the meeting's transcript. */
  spans: EvidenceSpan[];
  /** Proposed fields. For an update, only the ones that differ from the ticket. */
  changes: SuggestionChanges;
  reason: string;
};
