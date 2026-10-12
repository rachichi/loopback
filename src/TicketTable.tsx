import { useEffect, useRef } from "react";
import { formatEvidence, statusClass, statuses, ticketTypes, typeClass, type Status, type Ticket, type TicketType } from "./goldTickets";

// Evidence is edited by dragging highlights in the transcript; the ticket number is fixed.
type EditableField = "title" | "type" | "location" | "requester" | "summary" | "status";

export default function TicketTable({
  rows,
  selectedId,
  hoveredId,
  followHover,
  onHover,
  onSelect,
  onChange,
}: {
  rows: Ticket[];
  selectedId: string;
  hoveredId: string | null;
  followHover: boolean;
  onHover: (id: string | null) => void;
  onSelect: (ticket: Ticket) => void;
  onChange: (id: string, patch: Partial<Pick<Ticket, EditableField>>) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Only follow hovers that start in the transcript; scrolling under the cursor would jitter.
    if (!hoveredId || !followHover) return;
    scrollRef.current?.querySelector(`[data-ticket-id="${hoveredId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hoveredId, followHover]);

  const text = (ticket: Ticket, field: "title" | "location" | "requester" | "summary", label: string, rows = 2) => (
    <textarea
      className="cell-input"
      rows={rows}
      aria-label={`${label} for ${ticket.number}`}
      value={ticket[field]}
      onChange={(event) => onChange(ticket.id, { [field]: event.target.value })}
    />
  );

  return (
    <div className="table-scroll" ref={scrollRef} onMouseLeave={() => onHover(null)}>
      <div className="ticket-grid ticket-head" role="row">
        <div className="check-cell"><input type="checkbox" aria-label="Select all" /></div>
        <div>Title</div><div>Evidence</div><div>Type</div>
        <div>Location</div><div>Requester</div><div>Summary</div><div>Status</div>
      </div>
      {rows.length ? rows.map((ticket) => (
        <div
          role="row"
          className={`ticket-grid ticket-row ${selectedId === ticket.id ? "selected" : ""} ${hoveredId === ticket.id ? `hovered ${typeClass[ticket.type]}` : ""}`}
          key={ticket.id}
          data-ticket-id={ticket.id}
          onMouseEnter={() => onHover(ticket.id)}
          onClick={() => onSelect(ticket)}
        >
          <div className="check-cell"><input type="checkbox" aria-label={`Select ${ticket.number}`} onClick={(event) => event.stopPropagation()} /></div>
          <div>{text(ticket, "title", "Title")}</div>
          <div className="ticket-evidence" title={ticket.evidence.join(", ")}>
            <span>{formatEvidence(ticket.evidence)}</span>
            <small>{ticket.evidence.length} paragraphs</small>
          </div>
          <div>
            <select
              className={`cell-select tag type ${typeClass[ticket.type]}`}
              aria-label={`Type for ${ticket.number}`}
              value={ticket.type}
              onChange={(event) => onChange(ticket.id, { type: event.target.value as TicketType })}
            >
              {ticketTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </div>
          <div>{text(ticket, "location", "Location")}</div>
          <div>{text(ticket, "requester", "Requester")}</div>
          <div>{text(ticket, "summary", "Summary", 3)}</div>
          <div>
            <select
              className={`cell-select tag status ${statusClass[ticket.status]}`}
              aria-label={`Status for ${ticket.number}`}
              value={ticket.status}
              onChange={(event) => onChange(ticket.id, { status: event.target.value as Status })}
            >
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </div>
      )) : <div className="empty-results">No tickets match this view.</div>}
    </div>
  );
}
