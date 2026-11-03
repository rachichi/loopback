// Paragraphs and highlight spans for one meeting's transcript. The code lives with the Edge Functions,
// so the browser and match-transcript split a transcript into the same paragraphs and offsets.
export * from "../supabase/functions/_shared/transcript.ts";
