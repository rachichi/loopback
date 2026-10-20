// Demo tickets: the adjudicated gold sets for the bundled meetings (see meetings.ts).
import train1Csv from "../data/train1_goldtickets-Grid view.csv?raw";
import train2Csv from "../data/train2_goldtickets-Grid view.csv?raw";
import annotatorCsv from "../data/Annotator Tickets-Grid view.csv?raw";
import { meetingById } from "./meetings";
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

/** A highlight: a character range in one meeting's transcript. */
export type EvidenceSpan = Span & { meetingId: string };

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
  urgent: boolean;
  /** Due date as YYYY-MM-DD, or "" for none. */
  deadline: string;
  /** Who logged the ticket: the meeting it was drawn from, or the person who filled in the intake form. */
  submittedBy: string;
  /** Date logged as YYYY-MM-DD. */
  submittedAt: string;
  /** Every meeting where the issue was discussed, oldest first; empty for a ticket from the intake form. */
  meetingIds: string[];
  /** Highlighted character ranges in those meetings' transcripts; the source of truth for evidence. */
  spans: EvidenceSpan[];
  /** Paragraph ids the spans touch, per meeting id (derived; kept for display and search). */
  evidence: Record<string, string[]>;
};

function evidenceOf(meetingIds: string[], spans: EvidenceSpan[]): Record<string, string[]> {
  return Object.fromEntries(meetingIds.map((id) => [
    id,
    paragraphIdsFromSpans(meetingById(id)?.paragraphs ?? [], spans.filter((span) => span.meetingId === id)),
  ]));
}

/** Replace a ticket's highlights and recompute the paragraphs they cover. */
export function withSpans(ticket: Ticket, spans: EvidenceSpan[]): Ticket {
  return { ...ticket, spans, evidence: evidenceOf(ticket.meetingIds, spans) };
}

/** Today's local date as YYYY-MM-DD, the default for a new intake ticket. */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

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

// Mapped places for the 9/29/26 gold tickets. GeoSearch matches are its coordinates; it can't
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

// The 9/29/26 gold tickets have no requester or summary; borrow them from an annotator ticket each was
// adjudicated from. (The annotator tickets are all from that meeting; the 7/28/26 gold has its own.)
const annotatorTickets = Object.fromEntries(parseCsv(annotatorCsv).map((r) => [r["Ticket - Annotator"], r]));

const goldSets = [
  { meetingId: "cb3-full-2026-09-29", rows: parseCsv(train1Csv), places: seedPlaces, annotators: true },
  { meetingId: "cb3-full-2026-07-28", rows: parseCsv(train2Csv), places: {} as Record<string, Place[]>, annotators: false },
];
const sourcesOf = (r: Record<string, string>) => r.source_tickets.split(",").map((id) => id.trim()).filter(Boolean);

// One gold ticket per meeting, before tickets for the same issue are merged. Gold ids restart
// at G1 in each meeting, so ids are prefixed with the meeting.
const meetingTickets = goldSets.flatMap(({ meetingId, rows, places, annotators }) => {
  const meeting = meetingById(meetingId)!;
  // Prefer a source ticket that fed only this gold ticket (one annotator ticket merged G9 and G12).
  const sourceUses: Record<string, number> = {};
  for (const r of rows) for (const id of sourcesOf(r)) sourceUses[id] = (sourceUses[id] ?? 0) + 1;
  return rows.map((r) => {
    const sources = sourcesOf(r);
    const source = annotators ? annotatorTickets[sources.find((id) => sourceUses[id] === 1) ?? sources[0]] : undefined;
    const spans = spansFromParagraphIds(meeting.paragraphs, r.evidence.split(",").map((id) => id.trim()).filter(Boolean))
      .map((span) => ({ ...span, meetingId }));
    const ticket: Ticket = {
      id: `${meetingId}-${r.gold_id}`,
      number: "",
      title: r.title,
      type: r.type as TicketType,
      status: r.status as Status,
      location: { text: r.location_raw, places: places[r.gold_id] ?? [] },
      requester: r.requester || (source?.requester ?? ""),
      summary: r.summary || (source?.summary ?? ""),
      urgent: false,
      deadline: "",
      submittedBy: "Full Board Meeting",
      submittedAt: meeting.date,
      meetingIds: [meetingId],
      spans,
      evidence: evidenceOf([meetingId], spans),
    };
    // The gold files name the issue a ticket belongs to when it comes up at more than one meeting.
    return { ticket, issue: r.Issues ?? r.Issue ?? "" };
  });
});

// Tickets for the same issue become one ticket with evidence from each meeting. goldSets is newest
// first, so the newest meeting's fields (title, status, …) win and older meetings only fill blanks.
const byIssue = new Map<string, Ticket>();
const merged: Ticket[] = [];
for (const { ticket, issue } of meetingTickets) {
  const newer = issue ? byIssue.get(issue) : undefined;
  if (!newer) {
    merged.push(ticket);
    if (issue) byIssue.set(issue, ticket);
    continue;
  }
  newer.requester ||= ticket.requester;
  newer.summary ||= ticket.summary;
  newer.location = { text: newer.location.text || ticket.location.text, places: [...newer.location.places, ...ticket.location.places] };
  newer.submittedAt = ticket.submittedAt; // first raised
  newer.meetingIds = [...ticket.meetingIds, ...newer.meetingIds];
  newer.spans = [...ticket.spans, ...newer.spans];
  newer.evidence = { ...ticket.evidence, ...newer.evidence };
}
export const initialTickets: Ticket[] = merged.map((ticket, index) => ({ ...ticket, number: String(index + 1) }));

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

