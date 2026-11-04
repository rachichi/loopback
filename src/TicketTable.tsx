import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Calendar, Check, CircleChevronDown, FileText, MapPin, Maximize2, Rows2, Rows3, Rows4, Square, SquareCheck, Trash2, Type, X, type LucideIcon } from "lucide-react";
import LocationCell from "./LocationCell";
import { statusClass, statuses, type Status, type Ticket } from "./features/tickets/types";
import { useBoard, useTypeClass } from "./lib/board";
import { useDismiss } from "./lib/useDismiss";
import type { ReviewField, ReviewRow } from "./features/transcript/review";

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
const columns: readonly { key: EditableField | "transcript"; label: string; width: number; fieldType: string }[] = [
  // Order from spec section 6.2. The number, source, requester, owner, submitted by and date, created_by,
  // closed_at and evidence are stored but not columns. Meeting ids show in the Transcript column when
  // transcript_matching is on.
  { key: "title", label: "Title", width: 220, fieldType: "Text" },
  { key: "type", label: "Type", width: 140, fieldType: "Single select" },
  { key: "status", label: "Status", width: 100, fieldType: "Single select" },
  { key: "urgent", label: "Urgent", width: 70, fieldType: "Checkbox" },
  { key: "deadline", label: "Deadline", width: 110, fieldType: "Date" },
  { key: "location", label: "Map", width: 160, fieldType: "Map locations" },
  { key: "summary", label: "Summary", width: 320, fieldType: "Text" },
  // Only with transcript_matching.
  { key: "transcript", label: "Transcript", width: 180, fieldType: "Meetings where it was discussed; click one to open its transcript" },
] as const;
type ColumnKey = (typeof columns)[number]["key"];
const columnIcons: Record<ColumnKey, LucideIcon> = { ...fieldIcons, transcript: FileText };
const MIN_WIDTH = 60;
// Row number, or checkbox and expand button on hover.
const LEAD_WIDTH = 64;
const STORAGE_KEY = "loopback.ticketColumnWidths";
const defaultWidths = Object.fromEntries(columns.map((c) => [c.key, c.width])) as Record<ColumnKey, number>;

/** What the Transcript column needs from the transcript feature. Omitted when transcript_matching is off. */
export type TranscriptColumn = {
  /** Short name of a meeting, or undefined for a meeting this board doesn't have. */
  meetingLabel: (meetingId: string) => string | undefined;
  /** Open a meeting's transcript at the row's highlights. */
  onShow: (rowId: string, meetingId: string) => void;
};

/** Pending AI suggestions shown as greyed-out rows until staff review them. Omitted when transcript_matching is off. */
export type ReviewRows = {
  rows: Map<string, ReviewRow>;
  /** Approve the suggestion: the ticket is updated or created as shown. */
  onReviewed: (rowId: string) => Promise<void>;
  onReject: (rowId: string) => Promise<void>;
};

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
  transcript,
  review,
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
  transcript?: TranscriptColumn;
  review?: ReviewRows;
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
  // Review rows are suggestions, not tickets, so they can't be checked or deleted.
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const checkable = review ? rows.filter((ticket) => !review.rows.has(ticket.id)) : rows;
  const checkedRows = checkable.filter((ticket) => checked.has(ticket.id));
  const allChecked = checkable.length > 0 && checkedRows.length === checkable.length;
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
  const shown = transcript ? columns : columns.filter((column) => column.key !== "transcript");
  const gridStyle = {
    // A trailing 1fr filler track soaks up spare width so row fills and lines run to the edge.
    "--ticket-cols": `${LEAD_WIDTH}px ${shown.map((c) => `${widths[c.key]}px`).join(" ")} minmax(0, 1fr)`,
    "--ticket-width": `${LEAD_WIDTH + shown.reduce((sum, c) => sum + widths[c.key], 0)}px`,
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

  const [deciding, setDeciding] = useState<Set<string>>(new Set());
  const decide = (id: string, action: (rowId: string) => Promise<void>) => async (event: React.MouseEvent) => {
    event.stopPropagation();
    setDeciding((current) => new Set(current).add(id));
    try {
      await action(id);
    } finally {
      setDeciding((current) => { const next = new Set(current); next.delete(id); return next; });
    }
  };

  // A pending suggestion: read only and greyed out until Reviewed. Changed fields are marked, with the old value on hover.
  const reviewRow = (ticket: Ticket, info: ReviewRow, rowIndex: number) => {
    const mark = (field: ReviewField, value: string) => field in info.changed
      ? <span className="ai-changed" title={`Suggested from the transcript. Was: ${info.changed[field] || "(empty)"}`}>{value || "(empty)"}</span>
      : value;
    const busy = deciding.has(ticket.id);
    return (
      <div
        role="row"
        className={`ticket-grid ticket-row review-row ${selectedId === ticket.id ? "selected" : ""} ${hoveredId === ticket.id ? "hovered" : ""}`}
        key={ticket.id}
        data-ticket-id={ticket.id}
        onMouseEnter={() => onHover(ticket.id)}
        onClick={() => onSelect(ticket)}
      >
        <div className="lead-cell"><span className="row-index">{rowIndex + 1}</span></div>
        <div className="review-title">
          <span className="dim">{!info.ticketId && <span className="tag ai-new">New</span>} {mark("title", ticket.title)}</span>
          <div className="review-actions">
            <button type="button" className="reviewed" disabled={busy} onClick={decide(ticket.id, review!.onReviewed)} title={info.ticketId ? "Apply these changes to the ticket" : "Add this ticket"}><Check size={12} /> Reviewed</button>
            <button type="button" className="reject" disabled={busy} onClick={decide(ticket.id, review!.onReject)} title="Dismiss this suggestion"><X size={12} /> Reject</button>
          </div>
        </div>
        <div className="dim"><span className={`tag type ${typeClass(ticket.type)}`}>{mark("type", ticket.type)}</span></div>
        <div className="dim"><span className={`tag status ${statusClass[ticket.status]}`}>{mark("status", ticket.status)}</span></div>
        <div className="urgent-cell dim"><input type="checkbox" checked={ticket.urgent} disabled aria-label={`Urgent: ${ticket.number || ticket.title}`} /></div>
        <div className="dim read-only">{mark("deadline", ticket.deadline)}</div>
        <div className="dim read-only">{mark("location", ticket.location.text)}</div>
        <div className="dim read-only review-summary">{mark("summary", ticket.summary)}</div>
        {transcript && <div className="transcript-cell">{transcriptCell(ticket, transcript, info.suggestion.meetingId)}</div>}
      </div>
    );
  };

  return (
    <div className={`table-scroll rows-${rowHeight}`} ref={scrollRef} style={gridStyle} onMouseLeave={() => onHover(null)}>
      <div className="ticket-grid ticket-head" role="row">
        <div className="lead-cell">
          <input
            ref={selectAllRef}
            type="checkbox"
            aria-label="Select all"
            checked={allChecked}
            disabled={!checkable.length}
            onChange={(event) => setChecked(event.target.checked ? new Set(checkable.map((ticket) => ticket.id)) : new Set())}
          />
        </div>
        {shown.map((column) => {
          const Icon = columnIcons[column.key];
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
      {rows.length ? rows.map((ticket, rowIndex) => review?.rows.has(ticket.id) ? reviewRow(ticket, review.rows.get(ticket.id)!, rowIndex) : (
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
          {transcript && <div className="transcript-cell">{transcriptCell(ticket, transcript)}</div>}
        </div>
      )) : <div className="empty-results">{emptyMessage}</div>}
      {menu && onDelete && <RowMenu {...menu} onDelete={onDelete} onClose={closeMenu} />}
    </div>
  );
}

/** Meeting tags, oldest first as stored. On a review row, the suggestion's meeting is marked. */
function transcriptCell(ticket: Ticket, transcript: TranscriptColumn, suggestedFrom?: string) {
  return ticket.meetingIds.map((meetingId) => {
    const label = transcript.meetingLabel(meetingId);
    if (!label) return null;
    return (
      <button
        key={meetingId}
        type="button"
        className={`meeting-tag ${meetingId === suggestedFrom ? "suggested" : ""}`}
        title={`${label}${meetingId === suggestedFrom ? "\nThe suggestion comes from this meeting" : ""}\nClick to open the transcript`}
        onClick={(event) => { event.stopPropagation(); transcript.onShow(ticket.id, meetingId); }}
      >
        {label}
      </button>
    );
  });
}
