// Mapping between a Ticket and a row of the tickets table. No database access here, so
// scripts/make_supabase_seed.mjs can use it without Supabase credentials.
import type { Status, Ticket } from "./types";

/** The columns of the tickets table that the client reads and writes. */
export type TicketRow = {
  id: string;
  board: string;
  number: number;
  title: string;
  type: string;
  status: string;
  urgent: boolean;
  deadline: string | null;
  location_text: string;
  places: Ticket["location"]["places"];
  requester: string;
  summary: string;
  submitted_by: string;
  submitted_at: string;
  meeting_ids: string[];
  spans: Ticket["spans"];
};

export function toRow(ticket: Ticket, board: string): TicketRow {
  return {
    id: ticket.id,
    board,
    number: Number(ticket.number) || 0,
    title: ticket.title,
    type: ticket.type,
    status: ticket.status,
    urgent: ticket.urgent,
    deadline: ticket.deadline || null,
    location_text: ticket.location.text,
    places: ticket.location.places,
    requester: ticket.requester,
    summary: ticket.summary,
    submitted_by: ticket.submittedBy,
    submitted_at: ticket.submittedAt,
    meeting_ids: ticket.meetingIds,
    spans: ticket.spans,
  };
}

export function fromRow(row: TicketRow): Ticket {
  const ticket: Ticket = {
    id: row.id,
    number: String(row.number),
    title: row.title,
    type: row.type,
    status: row.status as Status,
    urgent: row.urgent,
    deadline: row.deadline ?? "",
    location: { text: row.location_text, places: row.places },
    requester: row.requester,
    summary: row.summary,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    meetingIds: row.meeting_ids,
    spans: row.spans,
    // Paragraph ids are derived from the spans and the transcripts, which V1 doesn't ship, so they stay empty.
    evidence: {},
  };
  return ticket;
}
