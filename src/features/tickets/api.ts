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
      const { id: _id, board: _board, number: _number, ...fields } = toRow(ticket, board);
      // source, closed_at and created_by are never sent: the database owns them.
      const { data, error } = await db.from("tickets").update({ ...fields, owner_id: ticket.ownerId }).eq("id", ticket.id).select("id");
      if (error) throw error;
      // RLS hides rows the user may not touch, which shows up as zero rows updated rather than an error.
      if (!data?.length) throw new Error(`Ticket ${ticket.id} was not updated (missing, or not on this board).`);
    }),
  );
}

/** Deletes a ticket by id. Staff and platform admins only; RLS hides the row from anyone else, which
 *  shows up as zero rows deleted rather than an error. */
export async function deleteTicket(id: string): Promise<void> {
  const { data, error } = await db.from("tickets").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error(`Ticket ${id} was not deleted (missing, or you can't delete on this board).`);
}

/** Someone a ticket can be assigned to. */
export type StaffMember = { userId: string; email: string };

/** The board's staff, for the Owner column. Reads board_staff(), which only answers the board's staff
 *  and platform admins. */
export async function loadBoardStaff(board: string): Promise<StaffMember[]> {
  const { data, error } = await db.rpc("board_staff", { b: board });
  if (error) throw error;
  return ((data ?? []) as { user_id: string; email: string }[]).map((row) => ({ userId: row.user_id, email: row.email }));
}

/** One board's row of board_ticket_metrics (spec section 6.3), plus its counts by type and by source
 *  from board_ticket_counts. Both views run with the reader's permissions, so RLS applies. */
export type BoardMetrics = {
  openCount: number;
  byStatus: { open: number; inProgress: number; closed: number };
  overdueCount: number;
  /** null when no ticket has been closed. */
  medianDaysToClose: number | null;
  /** null when no ticket is open. */
  medianOpenAgeDays: number | null;
  maxOpenAgeDays: number | null;
  byType: { label: string; count: number }[];
  bySource: { source: string; count: number }[];
};

export async function loadMetrics(board: string): Promise<BoardMetrics> {
  const [metrics, counts] = await Promise.all([
    db.from("board_ticket_metrics").select("*").eq("board", board).maybeSingle(),
    db.from("board_ticket_counts").select("type, source, n").eq("board", board),
  ]);
  if (metrics.error) throw metrics.error;
  if (counts.error) throw counts.error;
  // The view groups by board, so a board with no tickets has no row: every count is zero.
  const row = metrics.data ?? {};
  const sum = (key: "type" | "source") => {
    const totals = new Map<string, number>();
    for (const item of (counts.data ?? []) as { type: string; source: string; n: number }[]) {
      totals.set(item[key], (totals.get(item[key]) ?? 0) + Number(item.n));
    }
    return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
  return {
    openCount: Number(row.open_count ?? 0),
    byStatus: { open: Number(row.status_open ?? 0), inProgress: Number(row.status_in_progress ?? 0), closed: Number(row.status_closed ?? 0) },
    overdueCount: Number(row.overdue_count ?? 0),
    medianDaysToClose: num(row.median_days_to_close),
    medianOpenAgeDays: num(row.median_open_age_days),
    maxOpenAgeDays: num(row.max_open_age_days),
    byType: sum("type").map(([label, count]) => ({ label, count })),
    bySource: sum("source").map(([source, count]) => ({ source, count })),
  };
}
