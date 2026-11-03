// The extractor lives in supabase/functions/_shared/extract.ts so the match-transcript Edge Function runs
// the same code. This wrapper adds what only the harness needs: reading prompts from disk.
import { readFileSync } from "node:fs";
import {
  buildSystemPrompt as buildFromText,
  extract as extractFromText,
  type ExtractOptions,
  type ExtractResult,
  type TicketType,
} from "../../supabase/functions/_shared/extract.ts";

export { costUsd, MODELS, previousBlock, ticketSchema, validate } from "../../supabase/functions/_shared/extract.ts";
export type { ExtractResult, ModelId, PreviousTicket } from "../../supabase/functions/_shared/extract.ts";

export function buildSystemPrompt(promptPath: string, types: TicketType[]): string {
  return buildFromText(readFileSync(promptPath, "utf8"), types);
}

export function extract(opts: Omit<ExtractOptions, "promptText"> & { promptPath: string }): Promise<ExtractResult> {
  const { promptPath, ...rest } = opts;
  return extractFromText({ ...rest, promptText: readFileSync(promptPath, "utf8") });
}
