// Demo tickets: the adjudicated gold set for the 9/29/26 full board meeting.
import goldCsv from "../data/Gold Tickets-Grid view.csv?raw";
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
export type Source = "SMS" | "Transcript" | "Email";

export type Ticket = {
  id: string;
  number: string;
  title: string;
  type: TicketType;
  status: Status;
  source: Source;
  document: string;
  owner: string;
  role: string;
  nextSteps: string[];
  location: string;
  requester: string;
  summary: string;
  coordinates?: [number, number];
  created: string;
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

// Placeholder owners until tickets carry real assignments.
const ownerByType: Record<TicketType, string> = {
  "Quality of Life Complaint": "District Office",
  "Public Safety Issue": "Public Safety Committee",
  "Liquor License": "SLA Licensing Committee",
  "Land Use Request": "Land Use Committee",
  "Transportation Request": "Transportation Committee",
  Other: "District Office",
  "Budget Priority": "Executive Committee",
  "Board Administration": "Executive Committee",
};

// Approximate map points for tickets with a mappable place (demo only).
const coordinatesById: Record<string, [number, number]> = {
  G1: [40.7325, -73.9861], // Third Avenue L station
  G2: [40.7292, -73.9845], // 11th Street & First Avenue
  G3: [40.7265, -73.9817], // Tompkins Square Park
  G4: [40.715, -73.9919], // 11 Allen Street
  G5: [40.7186, -73.9881], // Essex Market
  G6: [40.7105, -73.9905], // Pier across from Catherine Slip
  G7: [40.7283, -73.9905], // Cooper Square
  G14: [40.7155, -73.9935], // Canal Street at the Manhattan Bridge
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
    source: "Transcript",
    document: meetingTitle,
    owner: ownerByType[type] ?? "District Office",
    role: type,
    nextSteps: [],
    location: r.location_raw || "No location given",
    requester: source?.requester ?? "",
    summary: source?.summary ?? "",
    coordinates: coordinatesById[r.gold_id],
    created: "Sep 29",
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

