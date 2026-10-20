// Tickets in Supabase (see supabase/schema.sql). Without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// in .env.local the app runs on the bundled sample tickets and nothing is saved.
import { createClient } from "@supabase/supabase-js";
import { withSpans, type Status, type Ticket, type TicketType } from "./goldTickets";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const db = url && key ? createClient(url, key) : null;

/** The community board this deployment serves. Every board's tickets share one table; this app
 *  only loads and saves its own. Set VITE_BOARD in .env.local to run the app for another board. */
export const board = (import.meta.env.VITE_BOARD as string | undefined) ?? "b-cb-9";

/** A row of the tickets table. */
type TicketRow = {
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

export function toRow(ticket: Ticket): TicketRow {
  return {
    id: ticket.id,
    board,
    number: Number(ticket.number),
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

function fromRow(row: TicketRow): Ticket {
  const ticket: Ticket = {
    id: row.id,
    number: String(row.number),
    title: row.title,
    type: row.type as TicketType,
    status: row.status as Status,
    urgent: row.urgent,
    deadline: row.deadline ?? "",
    location: { text: row.location_text, places: row.places },
    requester: row.requester,
    summary: row.summary,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    meetingIds: row.meeting_ids,
    spans: [],
    evidence: {},
  };
  // Paragraph ids are derived from the spans, so they aren't stored.
  return withSpans(ticket, row.spans);
}

export async function loadTickets(): Promise<Ticket[]> {
  const { data, error } = await db!.from("tickets").select("*").eq("board", board).order("number");
  if (error) throw error;
  return (data as TicketRow[]).map(fromRow);
}

/** Insert or update tickets by id. */
export async function saveTickets(tickets: Ticket[]): Promise<void> {
  const { error } = await db!.from("tickets").upsert(tickets.map(toRow));
  if (error) throw error;
}
