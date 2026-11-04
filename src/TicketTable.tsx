import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Calendar, CircleChevronDown, MapPin, Maximize2, Rows2, Rows3, Rows4, Square, SquareCheck, Trash2, Type, type LucideIcon } from "lucide-react";
import LocationCell from "./LocationCell";
import { statusClass, statuses, type Status, type Ticket } from "./features/tickets/types";
import { useBoard, useTypeClass } from "./lib/board";
import { useDismiss } from "./lib/useDismiss";

// The ticket number is assigned by the database and fixed.
export type EditableField = "title" | "urgent" | "type" | "location" | "summary" | "deadline" | "status";

/** The icon for each field, shared by the table header and the ticket form so they agree. */
export const fieldIcons: Record<EditableField, LucideIcon> = {
  title: Type,
  type: CircleChevronDown,
  status: CircleChevronDown,
  urgent: SquareCheck,
  deadline: Calendar,
  location: MapPin,
  summary: Type,
};

// Resizable columns (after the fixed row number column), in pixels. The icon shows the field type, Airtable-style.
const columns: readonly { key: EditableField; label: string; width: number; fieldType: string }[] = [
  // Order from spec section 6.2. The number, source, requester, owner, submitted by and date, created_by,
  // closed_at, meeting ids and evidence are stored but not columns.
  { key: "title", label: "Title", width: 220, fieldType: "Text" },
  { key: "type", label: "Type", width: 140, fieldType: "Single select" },
  { key: "status", label: "Status", width: 100, fieldType: "Single select" },
  { key: "urgent", label: "Urgent", width: 70, fieldType: "Checkbox" },
  { key: "deadline", label: "Deadline", width: 110, fieldType: "Date" },
  { key: "location", label: "Map", width: 160, fieldType: "Map locations" },
  { key: "summary", label: "Summary", width: 320, fieldType: "Text" },
] as const;
type ColumnKey = (typeof columns)[number]["key"];
const MIN_WIDTH = 60;
// Row number, or checkbox and expand button on hover.
const LEAD_WIDTH = 64;
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

/** Row heights, as in Airtable. Also a per-viewer preference kept in browser storage. */
export const rowHeights = [
  { key: "short", label: "Short", px: 32, icon: Rows4 },
  { key: "medium", label: "Medium", px: 56, icon: Rows3 },
  { key: "tall", label: "Tall", px: 88, icon: Rows2 },
  { key: "extra-tall", label: "Extra tall", px: 128, icon: Square },
] as const;
export type RowHeight = (typeof rowHeights)[number]["key"];
const ROW_HEIGHT_KEY = "loopback.ticketRowHeight";

export function loadRowHeight(): RowHeight {
  try {
    const stored = localStorage.getItem(ROW_HEIGHT_KEY);
    return rowHeights.find((item) => item.key === stored)?.key ?? "short";
  } catch {
    return "short";
  }
}

export function saveRowHeight(value: RowHeight) {
  try { localStorage.setItem(ROW_HEIGHT_KEY, value); } catch { /* storage unavailable */ }
}

/** The right-click menu: deletes the checked rows, or the row clicked if it isn't checked. */
function RowMenu({ x, y, targets, onDelete, onClose }: { x: number; y: number; targets: Ticket[]; onDelete: (tickets: Ticket[]) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, true, onClose);
  useEffect(() => {
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);
  // Keep the menu on screen near the right and bottom edges.
  const style = { left: Math.min(x, window.innerWidth - 250), top: Math.min(y, window.innerHeight - 60) };
  return createPortal(
    <div className="popover-menu row-menu" role="menu" ref={ref} style={style} onContextMenu={(event) => event.preventDefault()}>
      <button type="button" role="menuitem" className="danger" onClick={() => { onClose(); onDelete(targets); }}>
        <Trash2 size={15} />
        <span>{targets.length > 1 ? `Delete all ${targets.length} selected tickets` : "Delete ticket"}</span>
      </button>
    </div>,
    document.body,
  );
}

export default function TicketTable({
  rows,
  selectedId,
  emptyMessage = "No tickets match this view.",
  hoveredId,
  followHover,
  rowHeight,
  onHover,
  onSelect,
  onExpand,
  onChange,
  onShowOnMap,
  onDelete,
}: {
  rows: Ticket[];
  selectedId: string;
  emptyMessage?: string;
  hoveredId: string | null;
  followHover: boolean;
  rowHeight: RowHeight;
  onHover: (id: string | null) => void;
  onSelect: (ticket: Ticket) => void;
  /** Opens the ticket in the ticket form. */
  onExpand: (ticket: Ticket) => void;
  onChange: (id: string, patch: Partial<Pick<Ticket, EditableField>>) => void;
  /** Omitted when the board's district_map flag is off; the Map cell then only edits places. */
  onShowOnMap?: (id: string, placeIndex: number) => void;
  /** Omitted for read-only users, which turns off the right-click menu. */
  onDelete?: (tickets: Ticket[]) => void;
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

  // Checked rows. Only the visible ones count, so a filter or tab change can never act on hidden tickets.
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const checkedRows = rows.filter((ticket) => checked.has(ticket.id));
  const allChecked = rows.length > 0 && checkedRows.length === rows.length;
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = checkedRows.length > 0 && !allChecked;
  }, [checkedRows.length, allChecked]);
  const toggle = (id: string, on: boolean) => setChecked((current) => {
    const next = new Set(current);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const [menu, setMenu] = useState<{ x: number; y: number; targets: Ticket[] } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const openMenu = (event: React.MouseEvent, ticket: Ticket) => {
    if (!onDelete) return;
    // While editing a field, keep the browser's menu for copy and paste.
    const target = event.target as HTMLElement;
    if (target.matches("input, textarea") && target === document.activeElement) return;
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, targets: checked.has(ticket.id) ? checkedRows : [ticket] });
  };

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
    // A trailing 1fr filler track soaks up spare width so row fills and lines run to the edge.
    "--ticket-cols": `${LEAD_WIDTH}px ${columns.map((c) => `${widths[c.key]}px`).join(" ")} minmax(0, 1fr)`,
    "--ticket-width": `${LEAD_WIDTH + columns.reduce((sum, c) => sum + widths[c.key], 0)}px`,
    "--row-height": `${rowHeights.find((item) => item.key === rowHeight)?.px ?? 32}px`,
  } as CSSProperties;

  const text = (ticket: Ticket, field: "title" | "summary", label: string) => (
    <textarea
      className="cell-input"
      rows={1}
      aria-label={`${label} for ${ticket.number}`}
      value={ticket[field]}
      onChange={(event) => onChange(ticket.id, { [field]: event.target.value })}
    />
  );

  const deadline = (ticket: Ticket) => (
    <input
      type="date"
      className="cell-input cell-date"
      aria-label={`Deadline for ${ticket.number}`}
      value={ticket.deadline}
      onChange={(event) => onChange(ticket.id, { deadline: event.target.value })}
    />
  );

  return (
    <div className={`table-scroll rows-${rowHeight}`} ref={scrollRef} style={gridStyle} onMouseLeave={() => onHover(null)}>
      <div className="ticket-grid ticket-head" role="row">
        <div className="lead-cell">
          <input
            ref={selectAllRef}
            type="checkbox"
            aria-label="Select all"
            checked={allChecked}
            disabled={!rows.length}
            onChange={(event) => setChecked(event.target.checked ? new Set(rows.map((ticket) => ticket.id)) : new Set())}
          />
        </div>
        {columns.map((column) => {
          const Icon = fieldIcons[column.key];
          return (
            <div key={column.key} className="resizable-head" title={column.fieldType}>
              <Icon className="field-icon" size={11} strokeWidth={2} aria-hidden="true" />
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
          );
        })}
      </div>
      {rows.length ? rows.map((ticket, rowIndex) => (
        <div
          role="row"
          className={`ticket-grid ticket-row ${selectedId === ticket.id ? "selected" : ""} ${checked.has(ticket.id) ? "checked" : ""} ${hoveredId === ticket.id ? "hovered" : ""}`}
          key={ticket.id}
          data-ticket-id={ticket.id}
          onMouseEnter={() => onHover(ticket.id)}
          onClick={() => onSelect(ticket)}
          onContextMenu={(event) => openMenu(event, ticket)}
        >
          {/* The row's position; on hover it turns into a checkbox and an expand button, as in Airtable. */}
          <div className="lead-cell">
            <span className="row-index">{rowIndex + 1}</span>
            <span className="row-controls">
              <input
                type="checkbox"
                aria-label={`Select row ${rowIndex + 1}`}
                checked={checked.has(ticket.id)}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => toggle(ticket.id, event.target.checked)}
              />
              <button type="button" className="row-expand" aria-label={`Expand row ${rowIndex + 1}`} title="Expand" onClick={(event) => { event.stopPropagation(); onExpand(ticket); }}>
                <Maximize2 size={11} />
              </button>
            </span>
          </div>
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
          <div>{deadline(ticket)}</div>
          {/* Clicking anywhere in the Map cell opens the map panel. */}
          {onShowOnMap
            ? <div className="opens-panel" onClick={(event) => { event.stopPropagation(); onShowOnMap(ticket.id, 0); }}><LocationCell location={ticket.location} label={ticket.number} onChange={(location) => onChange(ticket.id, { location })} onShowOnMap={(index) => onShowOnMap(ticket.id, index)} /></div>
            : <div><LocationCell location={ticket.location} label={ticket.number} onChange={(location) => onChange(ticket.id, { location })} /></div>}
          <div>{text(ticket, "summary", "Summary")}</div>
        </div>
      )) : <div className="empty-results">{emptyMessage}</div>}
      {menu && onDelete && <RowMenu {...menu} onDelete={onDelete} onClose={closeMenu} />}
    </div>
  );
}
