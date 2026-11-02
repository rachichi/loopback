// Fails if the production bundle contains transcript code or data. V1 ships with transcript_matching off,
// and the spec requires that no transcript UI or code path is reachable (section 7, meetings.ts; step 7).
// Leaving it out of the bundle is stronger than hiding it behind the flag at runtime.
//
// Run after `pnpm build`: node scripts/check_bundle.mjs
// When V2 brings transcripts back behind transcript_matching, load them with a dynamic import() so they
// land in a separate chunk, and limit this check to the entry chunk.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "dist/assets";
// Markers from src/TranscriptView.tsx, src/meetings.ts, src/transcript.ts and the bundled transcripts.
const forbidden = [
  "hl-handle", // TranscriptView drag handles
  "meeting-tag", // Transcript column tags
  "Full Board Meeting", // meetings.ts titles and the gold tickets' submitted_by
  "cb3-full-", // meeting ids
  "buildParagraphs", // transcript.ts (unminified name survives in some builds)
];

const files = readdirSync(dir).filter((name) => name.endsWith(".js"));
if (!files.length) {
  console.error(`No JavaScript in ${dir}. Run pnpm build first.`);
  process.exit(1);
}

const hits = [];
for (const name of files) {
  const text = readFileSync(join(dir, name), "utf8");
  for (const marker of forbidden) if (text.includes(marker)) hits.push(`${name}: ${marker}`);
}

if (hits.length) {
  console.error("Transcript code or data found in the bundle (transcript_matching is a V2 feature):");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log(`Bundle check passed: no transcript code in ${files.length} file(s).`);
