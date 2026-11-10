// Shared ticket types. Ticket types themselves (labels, colors, definitions) are per board and come from
// boards.ticket_types through useBoard(); statuses are global.
import type { Span } from "../../transcript";

export const statuses = ["Open", "In Progress", "Closed"] as const;
export type Status = (typeof statuses)[number];

/** Status values reuse the existing to-do / in-progress / complete styles. */
export const statusClass: Record<Status, string> = {
  Open: "to-do",
  "In Progress": "in-progress",
  Closed: "complete",
};

/** A geocoded point a ticket refers to. */
export type Place = {
  name: string;
  lat: number;
  lng: number;
  /** "geosearch" = matched by NYC GeoSearch; "manual" = placed by hand (search pick-up, pin drag, or seed data). */
  source: "geosearch" | "osm" | "centerline" | "manual";
};

/** A highlight: a character range in one meeting's transcript. */
export type EvidenceSpan = Span & { meetingId: string };

/** Two streets, typed by staff. Text only: it has no map point (NYC GeoSearch does not find intersections). */
export type CrossStreets = { a: string; b: string };

/** The location as said in the meeting, plus the mapped places it refers to (zero or more) and, optionally, the cross streets. */
export type TicketLocation = { text: string; places: Place[]; crossStreets?: CrossStreets };

export type Ticket = {
  id: string;
  number: string;
  title: string;
  /** A label from the board's ticket_types. */
  type: string;
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
  /** Staff member responsible (auth user id), or null. */
  ownerId: string | null;
  source: Source;
  /** Set by the database when the status becomes Closed; null while open. Read only. */
  closedAt: string | null;
  /** Auth user who created the ticket, set by the database. Read only. */
  createdBy: string | null;
  /** Paragraph ids the spans touch, per meeting id. Derived from the transcripts, so empty while V1 ships
   *  without them (spec section 7, meetings.ts). */
  evidence: Record<string, string[]>;
};

/** Where a ticket came from. V1 creates manual tickets only; transcript (V2) and email (V3) come later. */
export const sources = ["manual", "transcript", "email"] as const;
export type Source = (typeof sources)[number];

/** Today's local date as YYYY-MM-DD, the default for a new intake ticket. */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
