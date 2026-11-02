import type { GoldTicket, Ticket } from "./data.ts";

export type Pair = { pred: Ticket; gold: GoldTicket; jaccard: number };
export type OverSplit = { pred: Ticket; gold: GoldTicket; overlap: number };

export type ScoreResult = {
  pairs: Pair[];
  missed: GoldTicket[];
  spurious: Ticket[];
  overSplits: OverSplit[];
  precision: number; // matched / (matched + spurious); over-splits are not counted as false positives
  strictPrecision: number; // matched / all predictions
  recall: number;
  f1: number;
  typeAcc: number;
  statusAcc: number;
  evidence: { precision: number; recall: number; f1: number };
  typeErrors: Pair[];
  statusErrors: Pair[];
};

export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

const ratio = (num: number, den: number) => (den === 0 ? 0 : num / den);
const f1 = (p: number, r: number) => (p + r === 0 ? 0 : (2 * p * r) / (p + r));

export function score(
  preds: Ticket[],
  gold: GoldTicket[],
  opts: { threshold?: number; overSplitMin?: number } = {},
): ScoreResult {
  const threshold = opts.threshold ?? 0.3;
  const overSplitMin = opts.overSplitMin ?? 0.5;

  // Greedy one-to-one matching, highest Jaccard first.
  const candidates: Pair[] = [];
  for (const pred of preds)
    for (const g of gold) {
      const j = jaccard(pred.evidence, g.evidence);
      if (j >= threshold) candidates.push({ pred, gold: g, jaccard: j });
    }
  candidates.sort((a, b) => b.jaccard - a.jaccard);

  const usedPred = new Set<string>();
  const usedGold = new Set<string>();
  const pairs: Pair[] = [];
  for (const c of candidates) {
    if (usedPred.has(c.pred.id) || usedGold.has(c.gold.id)) continue;
    usedPred.add(c.pred.id);
    usedGold.add(c.gold.id);
    pairs.push(c);
  }

  // Unmatched predictions mostly inside an already matched gold ticket are over-splits.
  const matchedGold = gold.filter((g) => usedGold.has(g.id));
  const spurious: Ticket[] = [];
  const overSplits: OverSplit[] = [];
  for (const pred of preds) {
    if (usedPred.has(pred.id)) continue;
    let best: OverSplit | undefined;
    for (const g of matchedGold) {
      const gs = new Set(g.evidence);
      const overlap = ratio(pred.evidence.filter((p) => gs.has(p)).length, pred.evidence.length);
      if (!best || overlap > best.overlap) best = { pred, gold: g, overlap };
    }
    if (best && best.overlap >= overSplitMin) overSplits.push(best);
    else spurious.push(pred);
  }

  const tp = pairs.length;
  const precision = ratio(tp, tp + spurious.length);
  const recall = ratio(tp, gold.length);

  // Paragraph-level evidence overlap, micro-averaged over matched pairs.
  let inter = 0;
  let predParas = 0;
  let goldParas = 0;
  for (const { pred, gold: g } of pairs) {
    const gs = new Set(g.evidence);
    inter += pred.evidence.filter((p) => gs.has(p)).length;
    predParas += pred.evidence.length;
    goldParas += g.evidence.length;
  }
  const evP = ratio(inter, predParas);
  const evR = ratio(inter, goldParas);

  const typeErrors = pairs.filter((p) => p.pred.type !== p.gold.type);
  const statusErrors = pairs.filter((p) => p.pred.status !== p.gold.status);

  return {
    pairs: pairs.sort((a, b) => goldOrder(a.gold.id) - goldOrder(b.gold.id)),
    missed: gold.filter((g) => !usedGold.has(g.id)),
    spurious,
    overSplits,
    precision,
    strictPrecision: ratio(tp, preds.length),
    recall,
    f1: f1(precision, recall),
    typeAcc: ratio(tp - typeErrors.length, tp),
    statusAcc: ratio(tp - statusErrors.length, tp),
    evidence: { precision: evP, recall: evR, f1: f1(evP, evR) },
    typeErrors,
    statusErrors,
  };
}

const goldOrder = (id: string) => Number(id.replace(/\D/g, "")) || 0;
