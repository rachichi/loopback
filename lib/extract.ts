import { readFileSync } from "node:fs";
import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { STATUSES, type Paragraph, type Ticket, type TicketType } from "./data.ts";

export const MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5"] as const;
export type ModelId = (typeof MODELS)[number];

// USD per million tokens. Haiku 5.5 doubles to $0.50 / $2.50 once a prompt exceeds 100K tokens.
const PRICING: Record<ModelId, (inputTokens: number) => { input: number; output: number }> = {
  "claude-haiku-5-5": (n) => (n > 100_000 ? { input: 0.5, output: 2.5 } : { input: 0.1, output: 0.5 }),
  "claude-sonnet-5-5": () => ({ input: 2, output: 10 }),
};

export function costUsd(model: ModelId, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model](inputTokens);
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export function ticketSchema(types: TicketType[]) {
  const typeNames = types.map((t) => t.name) as [string, ...string[]];
  const ticket = z.object({
    title: z.string().describe("3-10 words naming the issue"),
    evidence: z.array(z.string()).describe('Paragraph ids that discuss the issue, e.g. ["P15", "P17"]'),
    type: z.enum(typeNames),
    location_raw: z.string().describe("Location copied verbatim from the transcript, or empty string"),
    summary: z.string().describe('2-4 sentences, ending with a sentence starting "Action: "'),
    status: z.enum(STATUSES),
  });
  return z.object({ tickets: z.array(ticket) });
}

export function buildSystemPrompt(promptPath: string, types: TicketType[]): string {
  const defs = types.map((t) => `- ${t.name}: ${t.definition}`).join("\n");
  return readFileSync(promptPath, "utf8").replace("{{TYPE_DEFINITIONS}}", defs);
}

export type ExtractResult = {
  tickets: Omit<Ticket, "id">[];
  dropped: string[];
  usage: { inputTokens: number; outputTokens: number; reasoningTokens?: number };
  finishReason: string;
  costUsd: number;
  /** Calls made, including retries of answers that stopped after a ticket or two. */
  attempts?: number;
};

type ExtractOptions = {
  paragraphs: Paragraph[];
  types: TicketType[];
  model: ModelId;
  promptPath: string;
  /** "off" disables extended thinking; "adaptive" lets the model decide (the API default). */
  thinking?: "adaptive" | "off";
  /** Thinking depth / token spend. Haiku 5.5 defaults to "medium". */
  effort?: "low" | "medium" | "high";
};

// Haiku 5.5 with adaptive thinking sometimes spends its output on reasoning and then writes
// only the first ticket or two before stopping normally (about 1 run in 3-6 on the 9/29 meeting).
// A full board meeting always has more action items than that, so a short answer is retried.
const MIN_TICKETS = 3;
const MAX_ATTEMPTS = 3;

export async function extract(opts: ExtractOptions): Promise<ExtractResult> {
  let total: ExtractResult | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await extractOnce(opts);
    // Every attempt is billed, so usage and cost accumulate across retries.
    total = {
      ...result,
      attempts: attempt,
      usage: {
        inputTokens: (total?.usage.inputTokens ?? 0) + result.usage.inputTokens,
        outputTokens: (total?.usage.outputTokens ?? 0) + result.usage.outputTokens,
        reasoningTokens: (total?.usage.reasoningTokens ?? 0) + (result.usage.reasoningTokens ?? 0),
      },
      costUsd: (total?.costUsd ?? 0) + result.costUsd,
    };
    if (result.tickets.length >= MIN_TICKETS) break;
  }
  return total!;
}

async function extractOnce(opts: ExtractOptions): Promise<ExtractResult> {
  const { paragraphs, types, model, promptPath, thinking = "adaptive", effort } = opts;
  const transcript = paragraphs.map((p) => `${p.id}\t${p.text}`).join("\n");

  const { object, usage, finishReason } = await generateObject({
    model: anthropic(model),
    schema: ticketSchema(types),
    system: buildSystemPrompt(promptPath, types),
    prompt: `<transcript>\n${transcript}\n</transcript>\n\nExtract the tickets from this transcript.`,
    maxOutputTokens: 16000,
    // Native structured outputs; Sonnet 5.5 rejects the forced tool call the jsonTool mode relies on.
    providerOptions: {
      anthropic: {
        structuredOutputMode: "outputFormat",
        ...(thinking === "off" ? { thinking: { type: "disabled" as const } } : {}),
        ...(effort ? { effort } : {}),
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const { tickets, dropped } = validate(object.tickets, paragraphs, types);
  const reasoningTokens = usage.outputTokenDetails?.reasoningTokens;
  return { tickets, dropped, usage: { inputTokens, outputTokens, reasoningTokens }, finishReason, costUsd: costUsd(model, inputTokens, outputTokens) };
}

/** Drop unknown para_ids, then drop tickets with empty evidence or an unknown type. */
export function validate(raw: Omit<Ticket, "id">[], paragraphs: Paragraph[], types: TicketType[]) {
  const known = new Set(paragraphs.map((p) => p.id));
  const typeNames = new Set(types.map((t) => t.name));
  const dropped: string[] = [];
  const tickets: Omit<Ticket, "id">[] = [];

  raw.forEach((t, i) => {
    const label = `#${i + 1} "${t.title}"`;
    const ids = [...new Set(t.evidence.map((e) => e.trim().toUpperCase()))];
    const bad = ids.filter((id) => !known.has(id));
    if (bad.length) dropped.push(`${label}: removed unknown para_ids ${bad.join(",")}`);
    const evidence = ids.filter((id) => known.has(id));

    if (!typeNames.has(t.type)) dropped.push(`${label}: dropped, unknown type "${t.type}"`);
    else if (!evidence.length) dropped.push(`${label}: dropped, no valid evidence`);
    else tickets.push({ ...t, evidence });
  });
  return { tickets, dropped };
}
