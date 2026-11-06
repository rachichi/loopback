import { Calendar, MapPin, Plus, Search } from "lucide-react";
import { UrgencyTabs, syncLabel, type Sync, type UrgencyTab } from "./TicketFilters";
import { statuses, statusClass, type Status, type Ticket } from "./features/tickets/types";
import { useFeature, useTypeClass } from "./lib/board";

/** The Tickets tab on a phone: the table as a list of cards, with the same search, status filter and tabs.
 *  Tapping a card opens the ticket form. Map and transcript need a wider screen. */
export default function MobileTickets({ rows, counted, urgency, setUrgency, query, setQuery, status, setStatus, sync, emptyMessage, inReview, showReview, onOpen, onNew }: {
  rows: Ticket[];
  /** Tickets after search and status, before the urgency tab, so each tab's count matches. */
  counted: Ticket[];
  urgency: UrgencyTab;
  setUrgency: (tab: UrgencyTab) => void;
  query: string;
  setQuery: (value: string) => void;
  status: "All" | Status;
  setStatus: (value: "All" | Status) => void;
  sync: Sync;
  emptyMessage: string;
  inReview: (id: string) => boolean;
  showReview: boolean;
  onOpen: (ticket: Ticket) => void;
  onNew: () => void;
}) {
  const intakeOn = useFeature("manual_intake");
  const typeClass = useTypeClass();
  return (
    <main className="mobile-tickets">
      <UrgencyTabs tab={urgency} setTab={setUrgency} tickets={counted} inReview={inReview} showReview={showReview} />
      <div className="mobile-tickets-tools">
        <label className="table-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a ticket" /></label>
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as "All" | Status)}>
          <option>All</option>{statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        {intakeOn && <button type="button" className="new-request" aria-label="New ticket" onClick={onNew}><Plus size={16} /></button>}
      </div>
      <div className="mobile-tickets-meta">
        <strong>{rows.length} tickets</strong>
        <span className={`sync-state ${sync}`} role="status">{syncLabel[sync]}</span>
      </div>
      {rows.length === 0 && <p className="mobile-tickets-empty">{emptyMessage}</p>}
      <ul className="ticket-cards">
        {rows.map((ticket) => {
          const where = ticket.location.places.map((place) => place.name).join("; ") || ticket.location.text;
          const pending = inReview(ticket.id);
          return (
            <li key={ticket.id}>
              <button type="button" className={`ticket-card ${ticket.urgent ? "urgent" : ""} ${pending ? "pending" : ""}`} onClick={() => onOpen(ticket)}>
                <span className="ticket-card-top">
                  <span className="ticket-card-number">{ticket.number ? `#${ticket.number}` : "New"}</span>
                  {ticket.urgent && <span className="ticket-card-urgent">Urgent</span>}
                  {pending && <span className="ticket-card-review">Review</span>}
                </span>
                <strong className="ticket-card-title">{ticket.title || "Untitled"}</strong>
                <span className="ticket-card-tags">
                  <span className={`tag type ${typeClass(ticket.type)}`}>{ticket.type}</span>
                  <span className={`tag status ${statusClass[ticket.status]}`}>{ticket.status}</span>
                </span>
                {(where || ticket.deadline) && (
                  <span className="ticket-card-meta">
                    {where && <span><MapPin size={12} aria-hidden="true" /> {where}</span>}
                    {ticket.deadline && <span><Calendar size={12} aria-hidden="true" /> Due {ticket.deadline}</span>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
