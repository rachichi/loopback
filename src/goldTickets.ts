// Demo tickets: the adjudicated gold sets for the bundled meetings (see meetings.ts).
// Not imported by the app. scripts/make_supabase_seed.mjs uses it to write supabase/seed.sql, and V2's
// transcript matching will use it again. Ticket types and colors come from boards.ticket_types.
import train1Csv from "../evals/data/train1_goldtickets-Grid view.csv?raw";
import train2Csv from "../evals/data/train2_goldtickets-Grid view.csv?raw";
import annotatorCsv from "../evals/data/Annotator Tickets-Grid view.csv?raw";
import { meetingById } from "./meetings";
import { paragraphIdsFromSpans, spansFromParagraphIds } from "./transcript";
import type { EvidenceSpan, Place, Status, Ticket } from "./features/tickets/types";

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
      type: r.type,
      status: r.status as Status,
      location: { text: r.location_raw, places: places[r.gold_id] ?? [] },
      contactName: "", contactPhone: "", contactEmail: "", actionsTaken: "", 
      requester: r.requester || (source?.requester ?? ""),
      summary: r.summary || (source?.summary ?? ""),
      urgent: false,
      deadline: "",
      submittedBy: "Full Board Meeting",
      submittedAt: meeting.date,
      meetingIds: [meetingId],
      spans,
      evidence: evidenceOf([meetingId], spans),
      ownerId: null,
      source: "transcript",
      closedAt: null,
      createdBy: null,
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
