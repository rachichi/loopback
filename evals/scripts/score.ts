/**
 * Score predicted tickets against gold.
 *
 *   tsx scripts/score.ts --run runs/v1-claude-haiku-5-5-1.json
 *   tsx scripts/score.ts --annotator "Claude Opus 5.5"
 *   tsx scripts/score.ts --all-annotators
 *
 * A run is scored against the gold file for its transcript (GOLD_BY_TRANSCRIPT); --gold overrides.
 *
 * Flags: --gold <csv> --annotators-csv <csv> --threshold 0.3 --over-split 0.5
 */
import { parseArgs } from "node:util";
import { DATA_FILES, GOLD_BY_TRANSCRIPT, loadAnnotatorTickets, loadGold, loadRejected, loadRunTickets, type GoldTicket, type Ticket } from "../lib/data.ts";
import { score, type ScoreResult } from "../lib/score.ts";

const { values: args } = parseArgs({
  options: {
    gold: { type: "string" },
    run: { type: "string" },
    annotator: { type: "string" },
    "all-annotators": { type: "boolean", default: false },
    "annotators-csv": { type: "string", default: DATA_FILES.annotators },
    threshold: { type: "string", default: "0.3" },
    "over-split": { type: "string", default: "0.5" },
  },
});

const opts = { threshold: Number(args.threshold), overSplitMin: Number(args["over-split"]) };
// Annotator tickets only exist for the train1 meeting; runs pick their gold below.
let gold = loadGold(args.gold ?? DATA_FILES.gold);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const titleOf = (t: Ticket) => `${t.id}  "${t.title}"`;

function printReport(label: string, preds: Ticket[], r: ScoreResult) {
  console.log(`\n=== ${label} — ${preds.length} predictions vs ${gold.length} gold (Jaccard ≥ ${opts.threshold}) ===`);
  console.log(`matched ${r.pairs.length} · missed ${r.missed.length} · spurious ${r.spurious.length} · over-splits ${r.overSplits.length}`);
  console.log(`precision ${pct(r.precision)} (strict, over-splits as FP: ${pct(r.strictPrecision)})  recall ${pct(r.recall)}  F1 ${pct(r.f1)}`);
  console.log(`type acc ${pct(r.typeAcc)}  status acc ${pct(r.statusAcc)}  (on ${r.pairs.length} matched)`);
  console.log(`evidence P ${pct(r.evidence.precision)}  R ${pct(r.evidence.recall)}  F1 ${pct(r.evidence.f1)}  (micro, matched pairs)`);

  console.log(`\nMatches:`);
  for (const p of r.pairs) console.log(`  ${p.gold.id.padEnd(4)} ← ${p.pred.id}  J=${p.jaccard.toFixed(2)}  "${p.pred.title}"`);
  const section = (name: string, lines: string[]) => {
    console.log(`\n${name} (${lines.length}):`);
    for (const l of lines) console.log(`  ${l}`);
    if (!lines.length) console.log("  —");
  };
  section("Missed gold", r.missed.map(titleOf));
  section("Spurious predictions", r.spurious.map(titleOf));
  section("Over-splits", r.overSplits.map((o) => `${titleOf(o.pred)}  → ${o.gold.id} (${pct(o.overlap)} inside)`));
  section("Type errors", r.typeErrors.map((p) => `${p.gold.id} ← ${p.pred.id}: predicted "${p.pred.type}", gold "${p.gold.type}"`));
  section("Status errors", r.statusErrors.map((p) => `${p.gold.id} ← ${p.pred.id}: predicted "${p.pred.status}", gold "${p.gold.status}"`));
}

/** Compare scorer matches to the adjudicators' source_tickets links. */
function sanityCheck(preds: Ticket[], r: ScoreResult): string[] {
  const linked = new Map<string, GoldTicket[]>();
  for (const g of gold) for (const src of g.sourceTickets) linked.set(src, [...(linked.get(src) ?? []), g]);
  const rejected = new Map(loadRejected().map((x) => [x.sourceTicket, x]));
  const matchedTo = new Map(r.pairs.map((p) => [p.pred.id, p.gold.id]));
  const overTo = new Map(r.overSplits.map((o) => [o.pred.id, o.gold.id]));

  const issues: string[] = [];
  for (const p of preds) {
    const gl = (linked.get(p.id) ?? []).map((g) => g.id);
    const m = matchedTo.get(p.id);
    const o = overTo.get(p.id);
    const rej = rejected.get(p.id);
    const scorer = m ? `matched ${m}` : o ? `over-split of ${o}` : "spurious";
    const adjud = gl.length ? `source of ${gl.join(",")}` : rej ? `rejected ${rej.id} (${rej.category})` : "unlinked";
    const agrees = m ? gl.includes(m) : o ? gl.includes(o) : gl.length === 0;
    if (!agrees) issues.push(`${p.id}: scorer says ${scorer}; gold says ${adjud}`);
  }
  return issues;
}

function scoreAnnotator(name: string, all: ReturnType<typeof loadAnnotatorTickets>, verbose: boolean) {
  const preds = all.filter((t) => t.annotator === name);
  if (!preds.length) throw new Error(`No tickets for annotator "${name}". Known: ${[...new Set(all.map((t) => t.annotator))].join(", ")}`);
  const r = score(preds, gold, opts);
  const issues = sanityCheck(preds, r);
  if (verbose) {
    printReport(name, preds, r);
    console.log(`\nSanity check vs gold source_tickets (${issues.length} disagreements):`);
    for (const i of issues) console.log(`  ${i}`);
    if (!issues.length) console.log("  — all matches agree");
  }
  return { name, preds, r, issues };
}

if (args.run) {
  const { run, tickets } = loadRunTickets(args.run);
  const goldPath = args.gold ?? GOLD_BY_TRANSCRIPT[run.transcript];
  if (!goldPath) {
    console.error(`${args.run}: no gold tickets for ${run.transcript}; known: ${Object.keys(GOLD_BY_TRANSCRIPT).join(", ")}`);
    process.exit(1);
  }
  gold = loadGold(goldPath);
  const r = score(tickets, gold, opts);
  printReport(`${run.prompt} · ${run.model} · run ${run.run}`, tickets, r);
} else if (args.annotator) {
  scoreAnnotator(args.annotator, loadAnnotatorTickets(args["annotators-csv"]), true);
} else if (args["all-annotators"]) {
  const all = loadAnnotatorTickets(args["annotators-csv"]);
  const results = [...new Set(all.map((t) => t.annotator))].map((n) => scoreAnnotator(n, all, false));
  console.table(
    Object.fromEntries(
      results.map(({ name, preds, r, issues }) => [
        name,
        {
          preds: preds.length,
          matched: r.pairs.length,
          missed: r.missed.length,
          spurious: r.spurious.length,
          "over-split": r.overSplits.length,
          P: pct(r.precision),
          R: pct(r.recall),
          F1: pct(r.f1),
          "type acc": pct(r.typeAcc),
          "status acc": pct(r.statusAcc),
          "evid F1": pct(r.evidence.f1),
          "sanity≠": issues.length,
        },
      ]),
    ),
  );
  for (const { name, issues } of results) {
    if (!issues.length) continue;
    console.log(`\nSanity disagreements — ${name}:`);
    for (const i of issues) console.log(`  ${i}`);
  }
} else {
  console.error("Pass --run <file>, --annotator <name>, or --all-annotators");
  process.exit(1);
}

