// Fails if transcript code reaches the main bundle, or demo transcript data reaches any bundle.
//
// Transcript matching (V2) is behind the transcript_matching flag. Its panel, TranscriptView and the
// paragraph code are loaded with a dynamic import() (src/App.tsx), so they land in a separate chunk that
// only boards with the flag download. The entry chunk must not contain them. The Transcript column, the
// Review tab's rows and the meeting and suggestion queries are in the entry chunk on purpose: they render
// nothing without the flag and carry no transcript text.
//
// The bundled CB3 demo transcripts and gold tickets (src/meetings.ts, src/goldTickets.ts) must not be in
// any chunk: transcripts come from the database.
//
// Run after `pnpm build`: node scripts/check_bundle.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "dist/assets";
// Markers from src/TranscriptView.tsx, src/features/transcript/TranscriptPanel.tsx and src/transcript.ts.
const notInEntry = [
  "hl-handle", // TranscriptView drag handles
  "match-status", // TranscriptPanel status line under the meeting picker
  "buildParagraphs", // transcript.ts (unminified name survives in some builds)
];
// Markers from src/meetings.ts and the bundled demo transcripts.
const nowhere = [
  "Full Board Meeting", // meetings.ts titles and the gold tickets' submitted_by
  "cb3-full-", // demo meeting ids
];

const files = readdirSync(dir).filter((name) => name.endsWith(".js"));
if (!files.length) {
  console.error(`No JavaScript in ${dir}. Run pnpm build first.`);
  process.exit(1);
}
// The entry chunk is the module script that index.html loads.
const entry = readFileSync("dist/index.html", "utf8").match(/<script[^>]+type="module"[^>]+src="\/assets\/([^"]+\.js)"/)?.[1];
if (!entry || !files.includes(entry)) {
  console.error("Couldn't find the entry chunk in dist/index.html.");
  process.exit(1);
}

const hits = [];
for (const name of files) {
  const text = readFileSync(join(dir, name), "utf8");
  for (const marker of nowhere) if (text.includes(marker)) hits.push(`${name}: ${marker} (demo data, not allowed in any chunk)`);
  if (name === entry) for (const marker of notInEntry) if (text.includes(marker)) hits.push(`${name}: ${marker} (transcript code, not allowed in the entry chunk)`);
}

if (hits.length) {
  console.error("Transcript code or demo data found in the bundle:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log(`Bundle check passed: no transcript code in the entry chunk (${entry}), no demo data in ${files.length} file(s).`);
