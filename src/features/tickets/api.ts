// Ticket queries. Every call takes the board id from BoardProvider; RLS is what actually limits a user to
// their own board, the filter here only keeps a platform admin's view to one board.
import { db } from "../../db";
import type { Ticket } from "./types";
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
    // Tickets made in the app come from the intake form, so their source is manual (spec section 6.1).
    .insert({ ...toRow(ticket, board), number: 0, source: "manual", owner_id: ticket.ownerId })
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
      const { id: _id, board: _board, number: _number, submitted_by: _by, submitted_at: _at, ...fields } = toRow(ticket, board);
      // source, closed_at, created_by and the submission fields are never sent: they are fixed at insert.
      const { data, error } = await db.from("tickets").update({ ...fields, owner_id: ticket.ownerId }).eq("id", ticket.id).select("id");
      if (error) throw error;
      // RLS hides rows the user may not touch, which shows up as zero rows updated rather than an error.
      if (!data?.length) throw new Error(`Ticket ${ticket.id} was not updated (missing, or not on this board).`);
    }),
  );
}

/** Deletes tickets by id and returns the ids actually deleted. Staff and platform admins only; RLS hides
 *  rows from anyone else, which shows up as fewer rows deleted rather than an error. */
export async function deleteTickets(ids: string[]): Promise<string[]> {
  const { data, error } = await db.from("tickets").delete().in("id", ids).select("id");
  if (error) throw error;
  return (data ?? []).map((row: { id: string }) => row.id);
}
