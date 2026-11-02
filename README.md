# Loopback — MVP

Loopback turns a community board meeting into a reviewed list of follow-up tickets. This branch (`mvp-state`) is the smallest version of the product: one screen where district office staff review tickets from a meeting against the meeting's own transcript and a map of the district.

The full vision (Block Party ingest, review actions, cross-meeting follow-up, routing, multi-board) is described on the `ideal-state` branch. The broader prototype with Calendar, Templates, Outreach, Forum, Kanban/Roadmap views, and the Dashboard lives on `staging`.

## What's in the MVP

**One screen, three linked parts.** It shows the CB3 Full Board Meeting of 9/29/26.

| Part | What it does |
| --- | --- |
| **Tickets table** (left) | The meeting's tickets. Title, Type, Map, Requester, Summary, and Status are editable in place; Transcript (the evidence paragraphs) is edited in the transcript. Search and status filter on top. Columns resize by dragging the header edges. |
| **Transcript** (right, default) | The full transcript, with each ticket's evidence highlighted in its type's color. Hover a highlight to light up its ticket and row; drag the bold end bars to change exactly which words count as evidence. Clicking a row scrolls to its first highlight. |
| **Map** (right) | OpenStreetMap with the CB3 boundary and a pin for every place a ticket concerns, colored by type. Hovering a pin highlights its row; clicking a place in the table's Map column flies to it. Add places from the table with NYC GeoSearch. |

**How tickets are made.** The tickets shown are the adjudicated gold set in `data/`. The extraction and eval scripts that generate and score tickets with Claude are kept on this branch:

```bash
npx tsx scripts/run.ts --model claude-haiku-5-5 --n 3      # draft tickets with prompts/v1.md
npx tsx scripts/score.ts --run runs/v1-claude-haiku-5-5-1.json
npx tsx scripts/score.ts --all-annotators                  # annotators vs gold
npx tsx scripts/log.ts runs/*.json                         # append scores + cost to results.csv
```

`run.ts` reads `ANTHROPIC_API_KEY` from `.env.local` (git-ignored).

## What the MVP leaves out

- No persistence: edits last for the session only.
- No accounts, roles, or access control. Don't enter confidential information.
- One bundled meeting; no Block Party ingest yet.
- No approve/reject/merge/split, no creating or deleting highlights.
- Map tiles use OpenStreetMap's public servers (demo traffic only); GeoSearch can't find intersections.

## Development

Requirements: Node.js 22.12 or later and pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm dev        # Vite dev server on $PORT (default 8443)
pnpm build
```

```text
.
├── data/                    # transcripts, gold/annotator/rejected tickets, ticket types
├── lib/  prompts/  scripts/ # extraction (AI SDK + Claude), scoring, run/log scripts
├── runs/  results.csv       # saved extraction runs and scores
└── src/
	├── App.tsx              # header, toolbar, workspace state
	├── TicketTable.tsx      # editable, resizable tickets table
	├── LocationCell.tsx     # Map column: places + GeoSearch picker
	├── TranscriptView.tsx   # transcript with draggable evidence highlights
	├── MapView.tsx          # Leaflet map, CB3 boundary, pins
	├── goldTickets.ts       # ticket types and demo tickets from data/
	├── transcript.ts        # paragraphs, offsets, span helpers
	├── geosearch.ts         # NYC GeoSearch client
	└── data/cb3-boundary.geojson
```

## MIT License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for the full license text.
