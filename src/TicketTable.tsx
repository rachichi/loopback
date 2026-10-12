import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CircleChevronDown, MapPin, ScrollText, Type, type LucideIcon } from "lucide-react";
import LocationCell from "./LocationCell";
import { formatEvidence, statusClass, statuses, ticketTypes, typeClass, type Status, type Ticket, type TicketType } from "./goldTickets";

// Evidence is edited by dragging highlights in the transcript; the ticket number is fixed.
type EditableField = "title" | "type" | "location" | "requester" | "summary" | "status";

// Resizable columns (after the fixed checkbox column), in pixels. The icon shows the field type, Airtable-style.
const columns: readonly { key: string; label: string; width: number; icon: LucideIcon; fieldType: string }[] = [
  // Icons match the right-panel tabs: Transcript (ScrollText) and Map (MapPin).
  { key: "title", label: "Title", width: 220, icon: Type, fieldType: "Text" },
  { key: "evidence", label: "Transcript", width: 120, icon: ScrollText, fieldType: "Transcript paragraphs (edit by dragging highlights)" },
  { key: "type", label: "Type", width: 140, icon: CircleChevronDown, fieldType: "Single select" },
  { key: "location", label: "Map", width: 160, icon: MapPin, fieldType: "Map locations" },
  { key: "requester", label: "Requester", width: 160, icon: Type, fieldType: "Text" },
  { key: "summary", label: "Summary", width: 320, icon: Type, fieldType: "Text" },
  { key: "status", label: "Status", width: 100, icon: CircleChevronDown, fieldType: "Single select" },
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
  onShowOnMap,
}: {
  rows: Ticket[];
  selectedId: string;
  hoveredId: string | null;
  followHover: boolean;
  onHover: (id: string | null) => void;
  onSelect: (ticket: Ticket) => void;
  onChange: (id: string, patch: Partial<Pick<Ticket, EditableField>>) => void;
  onShowOnMap: (id: string, placeIndex: number) => void;
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
    "--ticket-cols": `34px ${columns.map((c) => `${widths[c.key]}px`).join(" ")} minmax(0, 1fr)`,
    "--ticket-width": `${34 + columns.reduce((sum, c) => sum + widths[c.key], 0)}px`,
  } as CSSProperties;

  const text = (ticket: Ticket, field: "title" | "requester" | "summary", label: string, rows = 2) => (
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
          <div key={column.key} className="resizable-head" title={column.fieldType}>
            <column.icon className="field-icon" size={11} strokeWidth={2} aria-hidden="true" />
            <span className="field-label">{column.label}</span>
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
      {rows.length ? rows.map((ticket, rowIndex) => (
        <div
          role="row"
          className={`ticket-grid ticket-row ${selectedId === ticket.id ? "selected" : ""} ${hoveredId === ticket.id ? `hovered ${typeClass[ticket.type]}` : ""}`}
          key={ticket.id}
          data-ticket-id={ticket.id}
          onMouseEnter={() => onHover(ticket.id)}
          onClick={() => onSelect(ticket)}
        >
          {/* Row position in the current view (not a ticket id); the checkbox replaces it on hover. */}
          <div className="check-cell">
            <span className="row-number" aria-hidden="true">{rowIndex + 1}</span>
            <input type="checkbox" aria-label={`Select row ${rowIndex + 1}`} onClick={(event) => event.stopPropagation()} />
          </div>
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
          <div><LocationCell ticket={ticket} onChange={(location) => onChange(ticket.id, { location })} onShowOnMap={(index) => onShowOnMap(ticket.id, index)} /></div>
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
