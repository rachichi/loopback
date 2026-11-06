// generate-minutes: drafts the minutes of one meeting from its transcript and stores them on the meeting.
//
//   POST /functions/v1/generate-minutes   { "meeting_id": "<uuid>" }   with the caller's session JWT
//
// The caller must be able to edit the meeting's board (can_edit_board) and the board must have meetings_tab
// on; both are checked with the caller's own client, so RLS applies. Only the final write uses the service
// role. Minutes are drafted once per meeting: a second call is refused so staff's edits are never overwritten.
//
// Secrets: ANTHROPIC_API_KEY (function secrets). SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "@supabase/supabase-js";
import type { ModelId } from "../_shared/extract.ts";
import { markdownToHtml } from "../_shared/markdown.ts";
import { draftMinutes, publishableMinutes } from "../_shared/minutes.ts";
import { buildParagraphs } from "../_shared/transcript.ts";
import { PROMPT, PROMPT_VERSION } from "./prompt.ts";

const MODEL: ModelId = "claude-sonnet-5-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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

  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller } = await asUser.auth.getUser(authorization.slice("Bearer ".length));
  if (!caller.user) return json(401, { error: "Sign in first." });

  const { data: meeting, error: meetingError } = await asUser
    .from("meetings")
    .select("id, board, title, held_on, committee, transcript, minutes_generated_at")
    .eq("id", meetingId)
    .maybeSingle();
  if (meetingError) return json(500, { error: meetingError.message });
  if (!meeting) return json(404, { error: "No such meeting on a board you can see." });
  const board: string = meeting.board;

  const [canEdit, flags, boardRow] = await Promise.all([
    asUser.rpc("can_edit_board", { b: board }),
    asUser.from("board_effective_features").select("features").eq("board_id", board).maybeSingle(),
    asUser.from("boards").select("name").eq("id", board).single(),
  ]);
  for (const result of [canEdit, flags, boardRow]) if (result.error) return json(500, { error: result.error.message });
  if (canEdit.data !== true) return json(403, { error: "Only staff of this board can draft minutes." });
  if ((flags.data?.features as Record<string, unknown> | undefined)?.meetings_tab !== true) {
    return json(403, { error: "The Meetings tab is not turned on for this board." });
  }
  if (meeting.minutes_generated_at) return json(409, { error: "Minutes were already drafted for this meeting." });

  const paragraphs = buildParagraphs(meeting.transcript);
  if (!paragraphs.length) return json(400, { error: "This meeting has no transcript yet." });

  const header = [
    `Board: ${boardRow.data?.name ?? board}`,
    `Meeting: ${meeting.title}${meeting.committee ? ` (${meeting.committee})` : ""}`,
    `Date: ${meeting.held_on}`,
  ].join("\n");

  let result;
  try {
    result = await draftMinutes({ paragraphs, meeting: header, promptText: PROMPT, model: MODEL, apiKey });
  } catch (error) {
    console.error(error);
    return json(502, { error: "The model call failed. Try again in a minute." });
  }
  if (result.finishReason === "length") {
    return json(502, { error: "The draft was too long for this meeting and got cut off. Try again." });
  }

  const published = publishableMinutes(result.draft);
  const generatedAt = new Date().toISOString();
  const asService = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  // The is-null filter keeps a second simultaneous run from overwriting the first.
  const saved = await asService
    .from("meetings")
    .update({ minutes_md: result.draft, minutes_html: markdownToHtml(published), minutes_generated_at: generatedAt })
    .eq("id", meeting.id)
    .is("minutes_generated_at", null)
    .select("id");
  if (saved.error) return json(500, { error: saved.error.message });
  if (!saved.data?.length) return json(409, { error: "Minutes were already drafted for this meeting." });

  console.log(JSON.stringify({ meeting: meeting.id, cost_usd: result.costUsd }));
  return json(200, { minutes_generated_at: generatedAt, model: MODEL, prompt_version: PROMPT_VERSION });
});
