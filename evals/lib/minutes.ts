import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { loadParagraphs, type Paragraph } from "./data.ts";
import { costUsd, type ModelId } from "./extract.ts";

/** What the board office has for one meeting. Everything but `meeting` and `paragraphs` is optional. */
export type MinutesInputs = {
  /** Header facts: board, meeting type, date, location, time, livestream, signer. */
  meeting: string;
  paragraphs: Paragraph[];
  agenda?: string;
  /** Members, officers, committee chairs, elected officials and their usual representatives. */
  roster?: string;
  /** Earlier minutes of the same board, for headings and phrasing. */
  exampleMinutes?: string;
};

// File names inside a meeting folder such as data/b-cb-9/minutes/2026-09-29_general-board/.
const FILES = {
  meeting: "meeting.txt",
  transcript: "psplit_transcript.txt",
  agenda: "agenda.txt",
  roster: "roster.txt",
  exampleMinutes: "example_minutes.txt",
  official: "official_minutes.txt",
};

const readIfExists = (path: string) => (existsSync(path) ? readFileSync(path, "utf8").trim() : undefined);

export function loadMinutesInputs(dir: string): MinutesInputs {
  const meeting = readIfExists(join(dir, FILES.meeting));
  if (!meeting) throw new Error(`${dir} has no ${FILES.meeting}`);
  return {
    meeting,
    paragraphs: loadParagraphs(join(dir, FILES.transcript)),
    agenda: readIfExists(join(dir, FILES.agenda)),
    roster: readIfExists(join(dir, FILES.roster)),
    exampleMinutes: readIfExists(join(dir, FILES.exampleMinutes)),
  };
}

/** The published minutes of the meeting, if the folder has them. Never sent to the model. */
export function loadOfficialMinutes(dir: string): string | undefined {
  return readIfExists(join(dir, FILES.official));
}

/** Tags match the Inputs section of prompts/minutes/minutes-v1.md. The transcript goes last, after the short inputs. */
export function minutesUserMessage(inputs: MinutesInputs): string {
  const blocks: [string, string | undefined][] = [
    ["meeting", inputs.meeting],
    ["agenda", inputs.agenda],
    ["roster", inputs.roster],
    ["previous_minutes", inputs.exampleMinutes],
    ["transcript", inputs.paragraphs.map((p) => `${p.id}\t${p.text}`).join("\n")],
  ];
  return [
    ...blocks.filter(([, body]) => body).map(([tag, body]) => `<${tag}>\n${body}\n</${tag}>`),
    "Draft the minutes of this meeting.",
  ].join("\n\n");
}

export type MinutesResult = {
  /** Draft with [P..] source markers and the Staff review section. */
  draft: string;
  /** Source markers that name paragraphs the transcript does not have. */
  unknownIds: string[];
  usage: { inputTokens: number; outputTokens: number; reasoningTokens?: number };
  finishReason: string;
  costUsd: number;
};

export async function draftMinutes(opts: {
  inputs: MinutesInputs;
  model: ModelId;
  promptPath: string;
  effort?: "low" | "medium" | "high";
}): Promise<MinutesResult> {
  // At Sonnet 5.5's default effort (high) thinking can use up the whole output budget on a full meeting.
  const { inputs, model, promptPath, effort = "medium" } = opts;
  const { text, usage, finishReason } = await generateText({
    model: anthropic(model),
    system: readFileSync(promptPath, "utf8"),
    prompt: minutesUserMessage(inputs),
    // A full general board meeting runs 2-4K words of minutes plus review notes; leave room for thinking.
    maxOutputTokens: 32000,
    providerOptions: { anthropic: { effort } satisfies AnthropicLanguageModelOptions },
  });

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const known = new Set(inputs.paragraphs.map((p) => p.id));
  return {
    draft: text.trim() + "\n",
    unknownIds: sourceMarkerIds(text).filter((id) => !known.has(id)),
    usage: { inputTokens, outputTokens, reasoningTokens: usage.outputTokenDetails?.reasoningTokens },
    finishReason,
    costUsd: costUsd(model, inputTokens, outputTokens),
  };
}

// "[P12]", "[P12, P15]", "[P44 through P63]", "[P3–P6]".
const MARKER = /\s*\[P\d+(?:\s*(?:,|;|-|–|—|to|through|and)\s*P\d+)*\]/g;

/** Every paragraph id cited in the draft, with ranges expanded. */
export function sourceMarkerIds(draft: string): string[] {
  const ids = new Set<string>();
  for (const marker of draft.match(MARKER) ?? []) {
    const nums = [...marker.matchAll(/P(\d+)/g)].map((m) => Number(m[1]));
    const isRange = /-|–|—|to|through/.test(marker.replace(/P\d+/g, ""));
    if (isRange && nums.length === 2 && nums[1] >= nums[0]) {
      for (let n = nums[0]; n <= nums[1]; n++) ids.add(`P${n}`);
    } else nums.forEach((n) => ids.add(`P${n}`));
  }
  return [...ids];
}

/** The minutes as they would be published: no source markers, no Staff review section. */
export function publishableMinutes(draft: string): string {
  return (
    draft
      .replace(/\n#{1,3} Staff review[\s\S]*$/, "")
      .replace(MARKER, "")
      .trimEnd() + "\n"
  );
}
