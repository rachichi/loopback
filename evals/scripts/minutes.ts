/**
 * Draft meeting minutes from a transcript and save them to runs/minutes/.
 *
 *   tsx scripts/minutes.ts --meeting data/b-cb-9/minutes/2026-09-29_general-board --model claude-sonnet-5-5
 *
 * A meeting folder holds meeting.txt and psplit_transcript.txt, plus optional agenda.txt,
 * roster.txt, example_minutes.txt and official_minutes.txt (see the folder's SOURCES.md).
 * Each run writes <prompt>-<model>-<meeting>-<i>.md (draft with source markers and Staff
 * review) and the same name with .published.md (markers and Staff review removed).
 *
 * Flags: --meeting <dir> --model <id> --prompt prompts/minutes/minutes-v1.md --effort low|medium|high (default medium) --n 1
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { MODELS, type ModelId } from "../lib/extract.ts";
import { draftMinutes, loadMinutesInputs, loadOfficialMinutes, publishableMinutes } from "../lib/minutes.ts";

for (const envFile of [".env.local", "../.env.local"]) if (existsSync(envFile)) process.loadEnvFile(envFile);

const { values: args } = parseArgs({
  options: {
    meeting: { type: "string", default: "data/b-cb-9/minutes/2026-09-29_general-board" },
    model: { type: "string", default: "claude-sonnet-5-5" },
    prompt: { type: "string", default: "prompts/minutes/minutes-v1.md" },
    effort: { type: "string" },
    n: { type: "string", default: "1" },
  },
});

const model = args.model as ModelId;
if (!MODELS.includes(model)) throw new Error(`--model must be one of ${MODELS.join(", ")}`);
const effort = args.effort as "low" | "medium" | "high" | undefined;
if (effort && !["low", "medium", "high"].includes(effort)) throw new Error("--effort must be low, medium or high");

const inputs = loadMinutesInputs(args.meeting);
const official = loadOfficialMinutes(args.meeting);
const name = `${basename(args.prompt, ".md")}-${model}-${basename(args.meeting)}`;
mkdirSync("runs/minutes", { recursive: true });

// Continue numbering after existing runs so nothing is overwritten.
let i = 1;
const nextPath = () => {
  while (existsSync(`runs/minutes/${name}-${i}.md`)) i++;
  return `runs/minutes/${name}-${i}.md`;
};

for (let k = 0; k < Number(args.n); k++) {
  const path = nextPath();
  const started = Date.now();
  const result = await draftMinutes({ inputs, model, promptPath: args.prompt, effort });
  writeFileSync(path, result.draft);
  const published = publishableMinutes(result.draft);
  writeFileSync(path.replace(/\.md$/, ".published.md"), published);

  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `${path}: ${words(published)} words published` +
      (official ? ` (official minutes: ${words(official)})` : "") +
      `, ${result.usage.inputTokens} in / ${result.usage.outputTokens} out, $${result.costUsd.toFixed(4)}, ${secs}s, ${result.finishReason}`,
  );
  if (result.finishReason !== "stop") console.log(`  stopped early (${result.finishReason}); the draft may be cut off`);
  if (result.unknownIds.length) console.log(`  source markers name paragraphs not in the transcript: ${result.unknownIds.join(", ")}`);
}
