// match-transcript: reads one meeting's transcript against the board's open tickets and stores what the
// model proposes as ticket_suggestions for staff to approve, edit or reject.
//
//   POST /functions/v1/match-transcript   { "meeting_id": "<uuid>" }   with the caller's session JWT
//
// The caller must be able to edit the meeting's board (can_edit_board) and the board must have
// transcript_matching on; both are checked here with the caller's own client, so RLS applies. Only the
// final write uses the service role. Running it again replaces the meeting's pending suggestions and
// keeps decided ones.
//
// Secrets: ANTHROPIC_API_KEY (function secrets). SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "@supabase/supabase-js";
import { NoObjectGeneratedError } from "ai";
import { extract, type ExtractedTicket, type ModelId, type PreviousTicket } from "../_shared/extract.ts";
import { buildParagraphs, spansFromParagraphIds } from "../_shared/transcript.ts";
import { PROMPT, PROMPT_VERSION } from "./prompt.ts";

const MODEL: ModelId = "claude-haiku-5-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type OpenTicket = {
  id: string;
  number: number;
  title: string;
  type: string;
  status: string;
  summary: string;
  location_text: string;
  requester: string;
  deadline: string | null;
  submitted_at: string;
};

type SuggestionRow = {
  board: string;
  meeting_id: string;
  ticket_id: string | null;
  kind: "update" | "new";
  evidence: string[];
  spans: { meetingId: string; start: number; end: number }[];
  changes: Record<string, string>;
  reason: string;
  model: string;
  prompt_version: string;
};

/** The model's deadline if it is a real YYYY-MM-DD date; anything else is dropped rather than failing the approval. */
function validDeadline(value: string | undefined): string {
  const d = value?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : "";
}

/** Fields of an update suggestion: only what the transcript adds or changes. Title and type stay staff's. */
function changesFor(result: ExtractedTicket, ticket: OpenTicket): Record<string, string> {
  const changes: Record<string, string> = {};
  if (result.status !== ticket.status) changes.status = result.status;
  if (result.summary?.trim() && result.summary.trim() !== ticket.summary.trim()) changes.summary = result.summary.trim();
  if (result.location_raw?.trim() && result.location_raw.trim() !== ticket.location_text.trim()) changes.location_text = result.location_raw.trim();
  if (result.requester?.trim() && result.requester.trim() !== ticket.requester.trim()) changes.requester = result.requester.trim();
  const deadline = validDeadline(result.deadline);
  if (deadline && deadline !== ticket.deadline) changes.deadline = deadline;
  return changes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Use POST." });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(500, { error: "ANTHROPIC_API_KEY is not set in the function's secrets." });
  const url = Deno.env.get("SUPABASE_URL")!;
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "Sign in first." });

  let meetingId: unknown;
  try {
    meetingId = (await req.json())?.meeting_id;
  } catch {
    return json(400, { error: "Send JSON: { \"meeting_id\": \"...\" }." });
  }
  if (typeof meetingId !== "string" || !/^[0-9a-f-]{36}$/i.test(meetingId)) return json(400, { error: "meeting_id must be a meeting's uuid." });

  // Everything up to the final write runs as the caller.
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The public anon key is a valid JWT too, so check for a signed-in user before touching any table.
  const { data: caller } = await asUser.auth.getUser(authorization.slice("Bearer ".length));
  if (!caller.user) return json(401, { error: "Sign in first." });

  const { data: meeting, error: meetingError } = await asUser
    .from("meetings")
    .select("id, board, title, held_on, transcript")
    .eq("id", meetingId)
    .maybeSingle();
  if (meetingError) return json(500, { error: meetingError.message });
  if (!meeting) return json(404, { error: "No such meeting on a board you can see." });
  const board: string = meeting.board;

  const [canEdit, flags, boardRow, open] = await Promise.all([
    asUser.rpc("can_edit_board", { b: board }),
    asUser.from("board_effective_features").select("features").eq("board_id", board).maybeSingle(),
    asUser.from("boards").select("ticket_types").eq("id", board).single(),
    asUser
      .from("tickets")
      .select("id, number, title, type, status, summary, location_text, requester, deadline, submitted_at")
      .eq("board", board)
      .neq("status", "Closed")
      .order("number"),
  ]);
  for (const result of [canEdit, flags, boardRow, open]) if (result.error) return json(500, { error: result.error.message });
  if (canEdit.data !== true) return json(403, { error: "Only staff of this board can run transcript matching." });
  if ((flags.data?.features as Record<string, unknown> | undefined)?.transcript_matching !== true) {
    return json(403, { error: "Transcript matching is not turned on for this board." });
  }

  const types = ((boardRow.data?.ticket_types ?? []) as { label: string; definition: string }[]).map((t) => ({ name: t.label, definition: t.definition ?? "" }));
  if (!types.length) return json(400, { error: "This board has no ticket types." });
  const tickets = (open.data ?? []) as OpenTicket[];
  const byNumber = new Map(tickets.map((t) => [String(t.number), t]));
  const previous: PreviousTicket[] = tickets.map((t) => ({
    number: String(t.number),
    title: t.title,
    type: t.type,
    status: t.status,
    summary: t.summary,
    location: t.location_text || undefined,
    loggedOn: t.submitted_at,
  }));

  const paragraphs = buildParagraphs(meeting.transcript);
  if (!paragraphs.length) return json(400, { error: "This meeting has no transcript yet." });

  let result;
  try {
    result = await extract({
      paragraphs,
      types,
      model: MODEL,
      promptText: PROMPT,
      previous,
      meeting: { title: meeting.title, date: meeting.held_on },
      apiKey,
      // A committee meeting can have only one or two action items, so only an empty answer is retried.
      minTickets: 1,
    });
  } catch (error) {
    console.error(error);
    if (NoObjectGeneratedError.isInstance(error) && error.finishReason === "length") {
      return json(502, { error: "The model's answer was too long for this meeting and got cut off. Try again; if it keeps happening, the meeting needs to be split." });
    }
    return json(502, { error: "The model call failed. Try again in a minute." });
  }

  // One suggestion per existing ticket: if the model links two issues to the same ticket, their evidence merges.
  const updates = new Map<string, SuggestionRow>();
  const rows: SuggestionRow[] = [];
  for (const t of result.tickets) {
    const evidence = t.evidence;
    const spans = spansFromParagraphIds(paragraphs, evidence).map((span) => ({ meetingId: meeting.id, ...span }));
    const base = { board, meeting_id: meeting.id, evidence, spans, model: MODEL, prompt_version: PROMPT_VERSION };
    const number = (t.matches_ticket ?? "").replace(/\D/g, "");
    const ticket = number ? byNumber.get(number) : undefined;
    if (ticket) {
      const existing = updates.get(ticket.id);
      if (existing) {
        existing.evidence = [...new Set([...existing.evidence, ...evidence])];
        existing.spans = spansFromParagraphIds(paragraphs, existing.evidence).map((span) => ({ meetingId: meeting.id, ...span }));
        continue;
      }
      const row: SuggestionRow = { ...base, ticket_id: ticket.id, kind: "update", changes: changesFor(t, ticket), reason: `Discussed as "${t.title.trim()}".` };
      updates.set(ticket.id, row);
      rows.push(row);
    } else {
      rows.push({
        ...base,
        ticket_id: null,
        kind: "new",
        changes: {
          title: t.title.trim(),
          type: t.type,
          status: t.status,
          summary: t.summary?.trim() ?? "",
          location_text: t.location_raw?.trim() ?? "",
          requester: t.requester?.trim() ?? "",
          deadline: validDeadline(t.deadline),
        },
        reason: number ? `The model linked this to #${number}, which is not an open ticket on this board.` : "",
      });
    }
  }

  // Replace this meeting's pending suggestions; approved and rejected ones stay as the record.
  const asService = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const cleared = await asService.from("ticket_suggestions").delete().eq("meeting_id", meeting.id).eq("status", "pending");
  if (cleared.error) return json(500, { error: cleared.error.message });
  if (rows.length) {
    const inserted = await asService.from("ticket_suggestions").insert(rows);
    if (inserted.error) return json(500, { error: inserted.error.message });
  }
  const matchedAt = new Date().toISOString();
  const stamped = await asService.from("meetings").update({ matched_at: matchedAt }).eq("id", meeting.id);
  if (stamped.error) return json(500, { error: stamped.error.message });

  console.log(JSON.stringify({ meeting: meeting.id, updates: updates.size, new: rows.length - updates.size, dropped: result.dropped.length, attempts: result.attempts, cost_usd: result.costUsd }));
  return json(200, {
    matched_at: matchedAt,
    updates: updates.size,
    new: rows.length - updates.size,
    dropped: result.dropped,
    model: MODEL,
    prompt_version: PROMPT_VERSION,
  });
});
