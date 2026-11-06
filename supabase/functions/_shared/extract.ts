// The ticket extractor, shared by the eval harness (evals/lib/extract.ts, Node) and the match-transcript
// Edge Function (Deno). No file system access: callers pass the prompt text. The bare imports resolve
// through node_modules in Node and through the function's deno.json import map in Deno.
import { anthropic, createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

export const STATUSES = ["Open", "In Progress", "Closed"] as const;
export type Status = (typeof STATUSES)[number];

export type Paragraph = { id: string; text: string };
export type TicketType = { name: string; definition: string };

/** A ticket as the model returns it. */
export type ExtractedTicket = {
  title: string;
  evidence: string[];
  type: string;
  status: string;
  location_raw?: string;
  requester?: string;
  summary?: string;
  /** Number of the existing ticket this issue is about, or "" (prompts from v5 on). */
  matches_ticket?: string;
  /** A possible risk to people's safety that needs quick action (prompts from v7 on). */
  urgent?: boolean;
  /** YYYY-MM-DD, or "" when the transcript gives none (prompts from v7 on). */
  deadline?: string;
};

/** A ticket given to the model as history: the previous meeting's tickets, or the board's open tickets. */
export type PreviousTicket = {
  title: string;
  type: string;
  status: string;
  summary?: string;
  /** When set, the ticket is listed as #<number> so the model can name it in matches_ticket. */
  number?: string;
  location?: string;
  /** Date logged, YYYY-MM-DD. */
  loggedOn?: string;
};

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

/** `matching` adds matches_ticket, for prompts that link issues to the board's existing tickets.
 *  `urgency` adds urgent and deadline. */
export function ticketSchema(types: TicketType[], matching = false, urgency = false) {
  const typeNames = types.map((t) => t.name) as [string, ...string[]];
  const ticket = z.object({
    title: z.string().describe("3-10 words naming the issue"),
    ...(matching
      ? { matches_ticket: z.string().describe('Number of the existing ticket this issue is about, e.g. "12", or empty string if none') }
      : {}),
    evidence: z.array(z.string()).describe('Paragraph ids that discuss the issue, e.g. ["P15", "P17"]'),
    type: z.enum(typeNames),
    location_raw: z.string().describe("Location copied verbatim from the transcript, or empty string"),
    requester: z.string().describe('Who raised the issue, with role in parentheses, e.g. "Jane Doe (public speaker)"'),
    ...(urgency
      ? {
          urgent: z.boolean().describe("True only if the transcript describes a real risk to people's safety or calls the issue urgent"),
          deadline: z.string().describe("YYYY-MM-DD if the transcript gives a deadline for the follow-up, or empty string"),
        }
      : {}),
    // Status comes before summary so the "Action: " sentence doesn't anchor it toward Open.
    status: z.enum(STATUSES),
    summary: z.string().describe('2-4 sentences, ending with a sentence starting "Action: "'),
  });
  return z.object({ tickets: z.array(ticket) });
}

/** The system prompt: the prompt text with the board's type definitions filled in. */
export function buildSystemPrompt(promptText: string, types: TicketType[]): string {
  const defs = types.map((t) => `- ${t.name}: ${t.definition}`).join("\n");
  return promptText.replace("{{TYPE_DEFINITIONS}}", defs);
}

/** Prompts that ask for matches_ticket mention it; older prompts get the original schema. */
export const promptMatches = (promptText: string) => promptText.includes("matches_ticket");

/** Prompts that ask for urgent and deadline mention both; older prompts get the schema without them. */
export const promptUrgency = (promptText: string) => promptText.includes("`urgent`") && promptText.includes("`deadline`");

export function previousBlock(previous: PreviousTicket[]): string {
  const lines = previous.map((t) => {
    const details = [t.type, `status then: ${t.status}`, ...(t.location ? [`location: ${t.location.trim()}`] : []), ...(t.loggedOn ? [`logged ${t.loggedOn}`] : [])];
    return `- ${t.number ? `#${t.number} ` : ""}${t.title.trim()} (${details.join("; ")})${t.summary ? `: ${t.summary.trim()}` : ""}`;
  });
  return `<previous_tickets>\n${lines.join("\n")}\n</previous_tickets>\n\n`;
}

export type ExtractResult = {
  tickets: ExtractedTicket[];
  dropped: string[];
  usage: { inputTokens: number; outputTokens: number; reasoningTokens?: number };
  finishReason: string;
  costUsd: number;
  /** Calls made, including retries of answers that stopped after a ticket or two. */
  attempts?: number;
};

export type ExtractOptions = {
  paragraphs: Paragraph[];
  types: TicketType[];
  model: ModelId;
  /** The prompt's text, before type definitions are filled in. */
  promptText: string;
  /** "off" disables extended thinking; "adaptive" lets the model decide (the API default). */
  thinking?: "adaptive" | "off";
  /** Thinking depth / token spend. Haiku 5.5 defaults to "medium". */
  effort?: "low" | "medium" | "high";
  /** Tickets given as history: the previous meeting's, or the board's open tickets. */
  previous?: PreviousTicket[];
  /** The meeting's title and date, stated before the transcript when given. */
  meeting?: { title: string; date: string };
  /** Anthropic key. Defaults to ANTHROPIC_API_KEY from the environment. */
  apiKey?: string;
  /** Fewest tickets an answer must have before it is accepted without a retry. */
  minTickets?: number;
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
    if (result.tickets.length >= (opts.minTickets ?? MIN_TICKETS)) break;
  }
  return total!;
}

async function extractOnce(opts: ExtractOptions): Promise<ExtractResult> {
  const { paragraphs, types, model, promptText, thinking = "adaptive", effort, previous, meeting, apiKey } = opts;
  const transcript = paragraphs.map((p) => `${p.id}\t${p.text}`).join("\n");
  const provider = apiKey ? createAnthropic({ apiKey }) : anthropic;
  const header = meeting ? `<meeting>${meeting.title}, ${meeting.date}</meeting>\n\n` : "";

  const { object, usage, finishReason } = await generateObject({
    model: provider(model),
    schema: ticketSchema(types, promptMatches(promptText), promptUrgency(promptText)),
    system: buildSystemPrompt(promptText, types),
    prompt: `${header}${previous?.length ? previousBlock(previous) : ""}<transcript>\n${transcript}\n</transcript>\n\nExtract the tickets from this transcript.`,
    // Thinking counts against this cap. A long hearing (31-37 tickets on CB9's 10/23 statement of needs)
    // takes 13-16K tokens at medium effort, so 16K cut the JSON off. 32K at ~240 tokens/s still ends
    // inside the Edge Function's 150 s limit on Supabase's free plan.
    maxOutputTokens: 32000,
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
  const { tickets, dropped } = validate(object.tickets as ExtractedTicket[], paragraphs, types);
  const reasoningTokens = usage.outputTokenDetails?.reasoningTokens;
  return { tickets, dropped, usage: { inputTokens, outputTokens, reasoningTokens }, finishReason, costUsd: costUsd(model, inputTokens, outputTokens) };
}

/** Drop unknown para_ids, then drop tickets with empty evidence or an unknown type. */
export function validate(raw: ExtractedTicket[], paragraphs: Paragraph[], types: TicketType[]) {
  const known = new Set(paragraphs.map((p) => p.id));
  const typeNames = new Set(types.map((t) => t.name));
  const dropped: string[] = [];
  const tickets: ExtractedTicket[] = [];

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
