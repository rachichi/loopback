/**
 * Score run files and append one row each to results.csv (skips runs already logged).
 *
 *   tsx scripts/log.ts runs/*.json
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { DATA_FILES, loadGold, loadRunTickets } from "../lib/data.ts";
import { score } from "../lib/score.ts";

const RESULTS = "results.csv";
const HEADER = "date,prompt,model,run,precision,recall,f1,type_acc,status_acc,evidence_f1,cost_usd";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: tsx scripts/log.ts runs/<file>.json [...]");
  process.exit(1);
}

if (!existsSync(RESULTS)) appendFileSync(RESULTS, HEADER + "\n");
const logged = new Set(
  readFileSync(RESULTS, "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((line) => line.split(",").slice(1, 4).join(",")),
);

const gold = loadGold();
const fmt = (x: number) => x.toFixed(3);

for (const file of files) {
  const { run, tickets } = loadRunTickets(file);
  if (run.transcript !== DATA_FILES.transcript) {
    console.log(`skip ${file} (run is on ${run.transcript}; gold tickets only exist for ${DATA_FILES.transcript})`);
    continue;
  }
  const key = [run.prompt, run.model, run.run].join(",");
  if (logged.has(key)) {
    console.log(`skip ${file} (already in ${RESULTS})`);
    continue;
  }
  const r = score(tickets, gold);
  const row = [
    run.createdAt.slice(0, 10),
    key,
    fmt(r.precision),
    fmt(r.recall),
    fmt(r.f1),
    fmt(r.typeAcc),
    fmt(r.statusAcc),
    fmt(r.evidence.f1),
    run.costUsd.toFixed(4),
  ].join(",");
  appendFileSync(RESULTS, row + "\n");
  logged.add(key);
  console.log(`logged ${file}: F1 ${fmt(r.f1)}, type ${fmt(r.typeAcc)}, status ${fmt(r.statusAcc)}, evidence F1 ${fmt(r.evidence.f1)}`);
}
