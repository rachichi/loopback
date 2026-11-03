import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Calendar, CircleChevronDown, Hash, Inbox, MapPin, SquareCheck, Trash2, Type, UserRound, type LucideIcon } from "lucide-react";
import LocationCell from "./LocationCell";
import { sourceLabel, statusClass, statuses, type Status, type Ticket } from "./features/tickets/types";
import { staffLabel, type StaffMember } from "./features/tickets/api";
import { useBoard, useTypeClass } from "./lib/board";

// The ticket number is assigned by the database and fixed.
type EditableField = "title" | "urgent" | "type" | "location" | "requester" | "ownerId" | "summary" | "deadline" | "status" | "submittedBy" | "submittedAt";

// Resizable columns (after the fixed checkbox column), in pixels. The icon shows the field type, Airtable-style.
const columns: readonly { key: string; label: string; width: number; icon: LucideIcon; fieldType: string }[] = [
  // Order from spec section 6.2. created_by, closed_at, meeting ids and evidence are not columns.
  { key: "number", label: "#", width: 56, icon: Hash, fieldType: "Ticket number (assigned by the database)" },
  { key: "title", label: "Title", width: 220, icon: Type, fieldType: "Text" },
  { key: "type", label: "Type", width: 140, icon: CircleChevronDown, fieldType: "Single select" },
  { key: "status", label: "Status", width: 100, icon: CircleChevronDown, fieldType: "Single select" },
  { key: "urgent", label: "Urgent", width: 70, icon: SquareCheck, fieldType: "Checkbox" },
  { key: "deadline", label: "Deadline", width: 110, icon: Calendar, fieldType: "Date" },
  { key: "location", label: "Map", width: 160, icon: MapPin, fieldType: "Map locations" },
  { key: "requester", label: "Requester", width: 160, icon: Type, fieldType: "Text" },
  { key: "owner", label: "Owner", width: 160, icon: UserRound, fieldType: "Staff member responsible" },
  { key: "summary", label: "Summary", width: 320, icon: Type, fieldType: "Text" },
  { key: "source", label: "Source", width: 90, icon: Inbox, fieldType: "Where the ticket came from (read only)" },
  { key: "submitted", label: "Submitted", width: 150, icon: Calendar, fieldType: "Date and who submitted it" },
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
  emptyMessage = "No tickets match this view.",
  hoveredId,
  followHover,
  onHover,
  onSelect,
  onChange,
  onShowOnMap,
  onDelete,
  staff,
}: {
  rows: Ticket[];
  selectedId: string;
  emptyMessage?: string;
  hoveredId: string | null;
  followHover: boolean;
  onHover: (id: string | null) => void;
  onSelect: (ticket: Ticket) => void;
  onChange: (id: string, patch: Partial<Pick<Ticket, EditableField>>) => void;
  /** Omitted when the board's district_map flag is off; the Map cell then only edits places. */
  onShowOnMap?: (id: string, placeIndex: number) => void;
  /** Omitted for read-only users, which hides the delete buttons. */
  onDelete?: (ticket: Ticket) => void;
  /** People the Owner column can assign: the board's staff. */
  staff: StaffMember[];
}) {
  const { ticketTypes } = useBoard();
  const typeClass = useTypeClass();
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
    // The trailing column holds the delete button, so it keeps 40px even when the table scrolls sideways.
    "--ticket-cols": `34px ${columns.map((c) => `${widths[c.key]}px`).join(" ")} minmax(40px, 1fr)`,
    "--ticket-width": `${34 + columns.reduce((sum, c) => sum + widths[c.key], 0) + 40}px`,
  } as CSSProperties;

  const text = (ticket: Ticket, field: "title" | "requester" | "summary" | "submittedBy", label: string, rows = 2) => (
    <textarea
      className="cell-input"
      rows={rows}
      aria-label={`${label} for ${ticket.number}`}
      value={ticket[field]}
      onChange={(event) => onChange(ticket.id, { [field]: event.target.value })}
    />
  );

  const date = (ticket: Ticket, field: "deadline" | "submittedAt", label: string) => (
    <input
      type="date"
      className="cell-input cell-date"
      aria-label={`${label} for ${ticket.number}`}
      value={ticket[field]}
      required={field === "submittedAt"}
      onChange={(event) => {
        // A deadline can be cleared; the submission date is required, so ignore clearing it.
        if (event.target.value || field === "deadline") onChange(ticket.id, { [field]: event.target.value });
      }}
    />
  );

  return (
    <div className="table-scroll" ref={scrollRef} style={gridStyle} onMouseLeave={() => onHover(null)}>
      <div className="ticket-grid ticket-head" role="row">
        <div className="check-cell"><input type="checkbox" aria-label="Select all" /></div>
        {columns.map((column) => (
          <div key={column.key} className="resizable-head" title={column.fieldType}>
            <column.icon className="field-icon" size={11} strokeWidth={2} aria-hidden="true" />
            {/* Without the map the column holds places only, so it's labelled Location. */}
            <span className="field-label">{column.key === "location" && !onShowOnMap ? "Location" : column.label}</span>
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
          className={`ticket-grid ticket-row ${selectedId === ticket.id ? "selected" : ""} ${hoveredId === ticket.id ? `hovered ${typeClass(ticket.type)}` : ""}`}
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
          <div className="number-cell">{ticket.number ? ticket.number : <span title="Saving: the database assigns the number">…</span>}</div>
          <div>{text(ticket, "title", "Title")}</div>
          <div>
            <select
              className={`cell-select tag type ${typeClass(ticket.type)}`}
              aria-label={`Type for ${ticket.number}`}
              value={ticket.type}
              onChange={(event) => onChange(ticket.id, { type: event.target.value })}
            >
              {ticketTypes.map((type) => <option key={type.label} title={type.definition}>{type.label}</option>)}
              {/* Keep a type the board no longer defines selectable, so the select doesn't misreport it. */}
              {!ticketTypes.some((type) => type.label === ticket.type) && <option>{ticket.type}</option>}
            </select>
          </div>
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
          <div className="urgent-cell">
            <input
              type="checkbox"
              aria-label={`Urgent: ${ticket.number}`}
              checked={ticket.urgent}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onChange(ticket.id, { urgent: event.target.checked })}
            />
          </div>
          <div>{date(ticket, "deadline", "Deadline")}</div>
          {/* Clicking anywhere in the Map cell opens the map panel. */}
          {onShowOnMap
            ? <div className="opens-panel" onClick={(event) => { event.stopPropagation(); onShowOnMap(ticket.id, 0); }}><LocationCell location={ticket.location} label={ticket.number} onChange={(location) => onChange(ticket.id, { location })} onShowOnMap={(index) => onShowOnMap(ticket.id, index)} /></div>
            : <div><LocationCell location={ticket.location} label={ticket.number} onChange={(location) => onChange(ticket.id, { location })} /></div>}
          <div>{text(ticket, "requester", "Requester")}</div>
          <div>
            <select
              className="cell-input cell-owner"
              aria-label={`Owner for ${ticket.number}`}
              value={ticket.ownerId ?? ""}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onChange(ticket.id, { ownerId: event.target.value || null })}
            >
              <option value="">Unassigned</option>
              {staff.map((member) => <option key={member.userId} value={member.userId}>{staffLabel(member)}</option>)}
              {/* An owner who has since left the board stays visible rather than silently reading as Unassigned. */}
              {ticket.ownerId && !staff.some((member) => member.userId === ticket.ownerId) && <option value={ticket.ownerId}>Former staff member</option>}
            </select>
          </div>
          <div>{text(ticket, "summary", "Summary", 3)}</div>
          <div><span className={`tag source ${ticket.source}`}>{sourceLabel[ticket.source] ?? ticket.source}</span></div>
          <div className="submitted-cell">
            {date(ticket, "submittedAt", "Submitted")}
            {text(ticket, "submittedBy", "Submitted by", 1)}
          </div>
          <div className="row-actions">
            {onDelete && (
              <button
                type="button"
                className="row-delete"
                aria-label={`Delete ticket ${ticket.number || ticket.title}`}
                title="Delete ticket"
                onClick={(event) => { event.stopPropagation(); onDelete(ticket); }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      )) : <div className="empty-results">{emptyMessage}</div>}
    </div>
  );
}
