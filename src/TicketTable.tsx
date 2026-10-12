import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatEvidence, statusClass, statuses, ticketTypes, typeClass, type Status, type Ticket, type TicketType } from "./goldTickets";

// Evidence is edited by dragging highlights in the transcript; the ticket number is fixed.
type EditableField = "title" | "type" | "location" | "requester" | "summary" | "status";

// Resizable columns (after the fixed checkbox column), in pixels.
const columns = [
  { key: "title", label: "Title", width: 220 },
  { key: "evidence", label: "Evidence", width: 120 },
  { key: "type", label: "Type", width: 140 },
  { key: "location", label: "Location", width: 160 },
  { key: "requester", label: "Requester", width: 160 },
  { key: "summary", label: "Summary", width: 320 },
  { key: "status", label: "Status", width: 100 },
] as const;
type ColumnKey = (typeof columns)[number]["key"];
const MIN_WIDTH = 60;
const STORAGE_KEY = "loopback.ticketColumnWidths";
const defaultWidths = Object.fromEntries(columns.map((c) => [c.key, c.width])) as Record<ColumnKey, number>;

// Widths are a per-viewer convenience, so browser storage is enough; it may be unavailable.
function loadWidths(): Record<ColumnKey, number> {
  try {
    return { ...defaultWidths, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return defaultWidths;
  }
}

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

  const [widths, setWidths] = useState(loadWidths);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(widths)); } catch { /* storage unavailable */ }
  }, [widths]);

  // Drag a header's right edge to resize that column; double-click the edge to reset it.
  const startResize = (event: React.MouseEvent, key: ColumnKey) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widths[key];
    document.body.classList.add("col-resizing");
    const move = (e: MouseEvent) => setWidths((current) => ({ ...current, [key]: Math.max(MIN_WIDTH, startWidth + e.clientX - startX) }));
    const up = () => {
      document.body.classList.remove("col-resizing");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const gridStyle = {
    "--ticket-cols": `34px ${columns.map((c) => `${widths[c.key]}px`).join(" ")}`,
    "--ticket-width": `${34 + columns.reduce((sum, c) => sum + widths[c.key], 0)}px`,
  } as CSSProperties;

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
    <div className="table-scroll" ref={scrollRef} style={gridStyle} onMouseLeave={() => onHover(null)}>
      <div className="ticket-grid ticket-head" role="row">
        <div className="check-cell"><input type="checkbox" aria-label="Select all" /></div>
        {columns.map((column) => (
          <div key={column.key} className="resizable-head">
            {column.label}
            <span
              className="col-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label={`Resize ${column.label} column`}
              title="Drag to resize · double-click to reset"
              onMouseDown={(event) => startResize(event, column.key)}
              onDoubleClick={() => setWidths((current) => ({ ...current, [column.key]: defaultWidths[column.key] }))}
            />
          </div>
        ))}
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
