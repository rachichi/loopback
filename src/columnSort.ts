// Sorting the Tickets table by a column header. Clicking a header sorts ascending, again descending, a third
// time returns to the table's own order. Blank cells (no deadline, no summary, no location) always come last.
import { statuses, type Ticket } from "./features/tickets/types";

export type SortKey = "title" | "type" | "status" | "urgent" | "deadline" | "location" | "summary" | "actionsTaken" | "contactName" | "contactPhone" | "contactEmail" | "agency" | "serviceRequestNumber" | "dateOpened";
export type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

export const nextSort = (current: Sort, key: SortKey): Sort =>
  current?.key !== key ? { key, dir: "asc" } : current.dir === "asc" ? { key, dir: "desc" } : null;

/** What a ticket sorts by under a column: text lower-cased, or a number; "" (or null) means blank. */
function valueOf(ticket: Ticket, key: SortKey): string | number {
  switch (key) {
    case "title": return ticket.title.trim().toLowerCase();
    case "type": return ticket.type.toLowerCase();
    // In the order of the status filter: Open, In Progress, Closed.
    case "status": return statuses.indexOf(ticket.status);
    // Ascending puts urgent tickets first, which is the useful way round.
    case "urgent": return ticket.urgent ? 0 : 1;
    // YYYY-MM-DD, so text order is date order.
    case "deadline": return ticket.deadline;
    case "location": return (ticket.location.places[0]?.name ?? (ticket.location.crossStreets ? `${ticket.location.crossStreets.a} & ${ticket.location.crossStreets.b}` : ticket.location.text)).trim().toLowerCase();
    case "summary": return ticket.summary.trim().toLowerCase();
    case "actionsTaken": return ticket.actionsTaken.trim().toLowerCase();
    case "agency": return ticket.agency.toLowerCase();
    case "serviceRequestNumber": return ticket.serviceRequestNumber.trim().toLowerCase();
    case "dateOpened": return ticket.dateOpened;
    case "contactName": return ticket.contactName.trim().toLowerCase();
    case "contactPhone": return ticket.contactPhone.trim();
    case "contactEmail": return ticket.contactEmail.trim().toLowerCase();
  }
}

/** The tickets in column order. Stable: ties keep their current order. */
export function sortTickets(tickets: Ticket[], sort: Sort): Ticket[] {
  if (!sort) return tickets;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...tickets].sort((a, b) => {
    const [x, y] = [valueOf(a, sort.key), valueOf(b, sort.key)];
    if (x === "" && y === "") return 0;
    if (x === "") return 1;
    if (y === "") return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }) * sign;
  });
}
