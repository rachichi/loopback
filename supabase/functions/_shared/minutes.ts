// Drafts minutes from a transcript. Same prompt and message layout as evals/lib/minutes.ts, but the prompt
// is passed as text because an Edge Function has no file system.
import { createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { costUsd, type ModelId, type Paragraph } from "./extract.ts";

// "[P12]", "[P12, P15]", "[P44 through P63]", "[P3-P6]".
const MARKER = /\s*\[P\d+(?:\s*(?:,|;|-|\u2013|\u2014|to|through|and)\s*P\d+)*\]/g;

/** The minutes as they would be published: no source markers, no Staff review section. */
export function publishableMinutes(draft: string): string {
  return draft.replace(/\n#{1,3} Staff review[\s\S]*$/, "").replace(MARKER, "").trimEnd() + "\n";
}

export async function draftMinutes(opts: {
  paragraphs: Paragraph[];
  meeting: string;
  promptText: string;
  model: ModelId;
  apiKey: string;
  effort?: "low" | "medium" | "high";
}) {
  const { paragraphs, meeting, promptText, model, apiKey, effort = "medium" } = opts;
  const prompt = [
    `<meeting>\n${meeting}\n</meeting>`,
    `<transcript>\n${paragraphs.map((p) => `${p.id}\t${p.text}`).join("\n")}\n</transcript>`,
    "Draft the minutes of this meeting.",
  ].join("\n\n");
  const { text, usage, finishReason } = await generateText({
    model: createAnthropic({ apiKey })(model),
    system: promptText,
    prompt,
    maxOutputTokens: 32000,
    providerOptions: { anthropic: { effort } satisfies AnthropicLanguageModelOptions },
  });
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  return { draft: text.trim() + "\n", finishReason, costUsd: costUsd(model, inputTokens, outputTokens) };
}
