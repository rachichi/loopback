// Demo tickets: the adjudicated gold set for the 9/29/26 full board meeting.
import goldCsv from "../data/train1_goldtickets-Grid view.csv?raw";
import annotatorCsv from "../data/Annotator Tickets-Grid view.csv?raw";
import { paragraphIdsFromSpans, spansFromParagraphIds, type Span } from "./transcript";

export const ticketTypes = [
  "Quality of Life Complaint",
  "Public Safety Issue",
  "Liquor License",
  "Land Use Request",
  "Transportation Request",
  "Other",
  "Budget Priority",
  "Board Administration",
] as const;
export type TicketType = (typeof ticketTypes)[number];

export const statuses = ["Open", "In Progress", "Closed"] as const;
export type Status = (typeof statuses)[number];

/** A geocoded point a ticket refers to. */
export type Place = {
  name: string;
  lat: number;
  lng: number;
  /** "geosearch" = matched by NYC GeoSearch; "manual" = placed by hand (search pick-up, pin drag, or seed data). */
  source: "geosearch" | "manual";
};

/** The location as said in the meeting, plus the mapped places it refers to (zero or more). */
export type TicketLocation = { text: string; places: Place[] };

export type Ticket = {
  id: string;
  number: string;
  title: string;
  type: TicketType;
  status: Status;
  location: TicketLocation;
  requester: string;
  summary: string;
  /** Highlighted character ranges in the transcript; the source of truth for evidence. */
  spans: Span[];
  /** Paragraph ids the spans touch (derived; kept for display and search). */
  evidence: string[];
};

/** Replace a ticket's highlights and recompute the paragraphs they cover. */
export function withSpans(ticket: Ticket, spans: Span[]): Ticket {
  return { ...ticket, spans, evidence: paragraphIdsFromSpans(spans) };
}

export const meetingTitle = "CB3 - Full Board Meeting (9/29/26)";

/** CSS class per type; the class sets the tag and highlight colors in index.css. */
export const typeClass: Record<TicketType, string> = {
  "Quality of Life Complaint": "quality",
  "Public Safety Issue": "safety",
  "Liquor License": "liquor",
  "Land Use Request": "land-use",
  "Transportation Request": "transport",
  Other: "other",
  "Budget Priority": "budget",
  "Board Administration": "admin",
};

/** Status values reuse the existing to-do / in-progress / complete styles. */
export const statusClass: Record<Status, string> = {
  Open: "to-do",
  "In Progress": "in-progress",
  Closed: "complete",
};

// Mapped places for the gold tickets. GeoSearch matches are its coordinates; it can't
// resolve intersections or garbled names, so those are approximate manual points.
// Tickets about the whole district, or places we can't identify, have none.
const seedPlaces: Record<string, Place[]> = {
  G1: [{ name: "3 Av (L) station, E 14 St & 3 Av", lat: 40.73281, lng: -73.98606, source: "manual" }],
  G2: [{ name: "E 11 St & 1 Av", lat: 40.72915, lng: -73.98425, source: "manual" }],
  G3: [
    { name: "Seward Park", lat: 40.71481, lng: -73.98928, source: "geosearch" },
    { name: "Tompkins Square Park", lat: 40.72645, lng: -73.98171, source: "geosearch" },
  ],
  G4: [{ name: "11 Allen Street", lat: 40.71493, lng: -73.99295, source: "geosearch" }],
  G5: [{ name: "Essex Market, 88 Essex Street", lat: 40.71793, lng: -73.98804, source: "geosearch" }],
  G6: [{ name: "East River pier at Catherine Slip", lat: 40.70885, lng: -73.99435, source: "manual" }],
  G7: [
    { name: "Delancey St & Suffolk St", lat: 40.71836, lng: -73.98583, source: "manual" },
    { name: "Cooper Square at E 6 St & 3 Av", lat: 40.72735, lng: -73.99063, source: "manual" },
  ],
  G14: [{ name: "Canal St at the Manhattan Bridge", lat: 40.71678, lng: -73.99545, source: "manual" }],
};

/** Minimal RFC 4180 parser: quoted fields may contain commas, quotes ("") and newlines. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body
    .filter((r) => r.some((cell) => cell.trim()))
    .map((r) => Object.fromEntries(header.map((name, i) => [name.trim(), (r[i] ?? "").trim()])));
}

// Gold tickets have no requester or summary; borrow them from an annotator ticket each was adjudicated from.
const annotatorTickets = Object.fromEntries(parseCsv(annotatorCsv).map((r) => [r["Ticket - Annotator"], r]));

const goldRows = parseCsv(goldCsv);
const sourcesOf = (r: Record<string, string>) => r.source_tickets.split(",").map((id) => id.trim()).filter(Boolean);
// Prefer a source ticket that fed only this gold ticket (one annotator ticket merged G9 and G12).
const sourceUses: Record<string, number> = {};
for (const r of goldRows) for (const id of sourcesOf(r)) sourceUses[id] = (sourceUses[id] ?? 0) + 1;

export const initialTickets: Ticket[] = goldRows.map((r) => {
  const type = r.type as TicketType;
  const sources = sourcesOf(r);
  const source = annotatorTickets[sources.find((id) => sourceUses[id] === 1) ?? sources[0]];
  return {
    id: r.gold_id,
    number: r.gold_id.replace(/\D/g, ""),
    title: r.title,
    type,
    status: r.status as Status,
    location: { text: r.location_raw, places: seedPlaces[r.gold_id] ?? [] },
    requester: source?.requester ?? "",
    summary: source?.summary ?? "",
    ...(() => {
      const spans = spansFromParagraphIds(r.evidence.split(",").map((id) => id.trim()).filter(Boolean));
      return { spans, evidence: paragraphIdsFromSpans(spans) };
    })(),
  };
});

/** ["P15", "P17", "P18", "P19"] -> "P15, P17–P19" */
export function formatEvidence(evidence: string[]): string {
  const nums = [...new Set(evidence.map((id) => Number(id.slice(1))))].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    parts.push(j > i ? `P${nums[i]}–P${nums[j]}` : `P${nums[i]}`);
    i = j;
  }
  return parts.join(", ");
}

