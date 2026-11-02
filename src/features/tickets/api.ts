// Ticket queries. Every call takes the board id from BoardProvider; RLS is what actually limits a user to
// their own board, the filter here only keeps a platform admin's view to one board.
import { db } from "../../db";
import type { Ticket } from "../../goldTickets";
import { fromRow, toRow, type TicketRow } from "./rows";

export async function loadTickets(board: string): Promise<Ticket[]> {
  const { data, error } = await db.from("tickets").select("*").eq("board", board).order("number");
  if (error) throw error;
  return (data as TicketRow[]).map(fromRow);
}

/** Inserts a new ticket. It is sent with number 0 and the database assigns the next number for the
 *  board; the returned ticket carries that number. */
export async function insertTicket(ticket: Ticket, board: string): Promise<Ticket> {
  const { data, error } = await db
    .from("tickets")
    .insert({ ...toRow(ticket, board), number: 0 })
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data as TicketRow);
}

/** Updates existing tickets by id. The number and board are never sent, so an update cannot renumber a
 *  ticket or move it to another board.
 *  TODO(spec section 7): whole-row updates are last-write-wins between two staff editing the same
 *  ticket. Add an updated_at check before boards have concurrent editors. */
export async function updateTickets(tickets: Ticket[], board: string): Promise<void> {
  await Promise.all(
    tickets.map(async (ticket) => {
      const { id: _id, board: _board, number: _number, ...fields } = toRow(ticket, board);
      const { data, error } = await db.from("tickets").update(fields).eq("id", ticket.id).select("id");
      if (error) throw error;
      // RLS hides rows the user may not touch, which shows up as zero rows updated rather than an error.
      if (!data?.length) throw new Error(`Ticket ${ticket.id} was not updated (missing, or not on this board).`);
    }),
  );
}
