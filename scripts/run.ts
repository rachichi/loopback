/**
 * Run the extractor and save each run to runs/<prompt>-<model>-<i>.json.
 *
 *   tsx scripts/run.ts --model claude-haiku-5-5 --prompt prompts/v1.md --n 3
 *
 * Flags: --transcript data/psplit_train.txt --model <id> --prompt <md> --n 1
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { DATA_FILES, loadParagraphs, loadTicketTypes, type RunFile } from "../lib/data.ts";
import { extract, MODELS, type ModelId } from "../lib/extract.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { values: args } = parseArgs({
  options: {
    transcript: { type: "string", default: DATA_FILES.transcript },
    model: { type: "string", default: "claude-haiku-5-5" },
    prompt: { type: "string", default: "prompts/v1.md" },
    n: { type: "string", default: "1" },
  },
});

const model = args.model as ModelId;
if (!MODELS.includes(model)) throw new Error(`--model must be one of ${MODELS.join(", ")}`);
const promptVersion = basename(args.prompt, ".md");
const n = Number(args.n);

const paragraphs = loadParagraphs(args.transcript);
const types = loadTicketTypes();
mkdirSync("runs", { recursive: true });

// Continue numbering after existing runs so nothing is overwritten.
let i = 1;
const nextPath = () => {
  while (existsSync(`runs/${promptVersion}-${model}-${i}.json`)) i++;
  return `runs/${promptVersion}-${model}-${i}.json`;
};

for (let k = 0; k < n; k++) {
  const path = nextPath();
  const started = Date.now();
  const result = await extract({ paragraphs, types, model, promptPath: args.prompt });
  const run: RunFile = {
    prompt: promptVersion,
    model,
    run: i,
    transcript: args.transcript,
    createdAt: new Date().toISOString(),
    usage: result.usage,
    costUsd: result.costUsd,
    tickets: result.tickets,
    dropped: result.dropped,
  };
  writeFileSync(path, JSON.stringify(run, null, 2) + "\n");
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `${path}: ${run.tickets.length} tickets, ${result.dropped.length} validator notes, ` +
      `${run.usage.inputTokens} in / ${run.usage.outputTokens} out, $${run.costUsd.toFixed(4)}, ${secs}s`,
  );
  for (const d of result.dropped) console.log(`  ${d}`);
}
