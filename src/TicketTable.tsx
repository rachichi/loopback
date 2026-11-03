import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Calendar, Check, CircleChevronDown, FileText, Hash, Inbox, MapPin, SquareCheck, Trash2, Type, X, type LucideIcon } from "lucide-react";
import LocationCell from "./LocationCell";
import { sourceLabel, statusClass, statuses, type Status, type Ticket } from "./features/tickets/types";
import { useBoard, useTypeClass } from "./lib/board";
import type { ReviewField, ReviewRow } from "./features/transcript/review";

// The ticket number is assigned by the database and fixed.
type EditableField = "title" | "urgent" | "type" | "location" | "summary" | "deadline" | "status";

// Resizable columns (after the fixed checkbox column), in pixels. The icon shows the field type, Airtable-style.
const columns: readonly { key: string; label: string; width: number; icon: LucideIcon; fieldType: string }[] = [
  // Order from spec section 6.2. Requester, owner, submitted by and date, created_by, closed_at and evidence
  // are stored but not columns. Meeting ids show in the Transcript column when transcript_matching is on.
  { key: "number", label: "#", width: 56, icon: Hash, fieldType: "Ticket number (assigned by the database)" },
  { key: "title", label: "Title", width: 220, icon: Type, fieldType: "Text" },
  { key: "type", label: "Type", width: 140, icon: CircleChevronDown, fieldType: "Single select" },
  { key: "status", label: "Status", width: 100, icon: CircleChevronDown, fieldType: "Single select" },
  { key: "urgent", label: "Urgent", width: 70, icon: SquareCheck, fieldType: "Checkbox" },
  { key: "deadline", label: "Deadline", width: 110, icon: Calendar, fieldType: "Date" },
  { key: "location", label: "Map", width: 160, icon: MapPin, fieldType: "Map locations" },
  { key: "summary", label: "Summary", width: 320, icon: Type, fieldType: "Text" },
  { key: "source", label: "Source", width: 90, icon: Inbox, fieldType: "Where the ticket came from (read only)" },
  // Only with transcript_matching.
  { key: "transcript", label: "Transcript", width: 180, icon: FileText, fieldType: "Meetings where it was discussed; click one to open its transcript" },
] as const;
type ColumnKey = (typeof columns)[number]["key"];
const MIN_WIDTH = 60;
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
  transcript,
  review,
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
  // Review rows whose Reviewed or Reject is waiting on the database.
  const [deciding, setDeciding] = useState<Set<string>>(new Set());
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
  const shown = transcript ? columns : columns.filter((column) => column.key !== "transcript");
  const gridStyle = {
    // The trailing column holds the delete button, so it keeps 40px even when the table scrolls sideways.
    "--ticket-cols": `34px ${shown.map((c) => `${widths[c.key]}px`).join(" ")} minmax(40px, 1fr)`,
    "--ticket-width": `${34 + shown.reduce((sum, c) => sum + widths[c.key], 0) + 40}px`,
  } as CSSProperties;

  const text = (ticket: Ticket, field: "title" | "summary", label: string, rows = 2) => (
    <textarea
      className="cell-input"
      rows={rows}
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
        className={`ticket-grid ticket-row review-row ${selectedId === ticket.id ? "selected" : ""} ${hoveredId === ticket.id ? `hovered ${typeClass(ticket.type)}` : ""}`}
        key={ticket.id}
        data-ticket-id={ticket.id}
        onMouseEnter={() => onHover(ticket.id)}
        onClick={() => onSelect(ticket)}
      >
        <div className="check-cell"><input type="checkbox" disabled aria-label={`Select row ${rowIndex + 1}`} /></div>
        <div className="number-cell">{info.ticketId ? <span className="dim">{ticket.number}</span> : <span className="tag ai-new">New</span>}</div>
        <div className="review-title">
          <span className="dim">{mark("title", ticket.title)}</span>
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
        <div className="dim"><span className="tag source transcript">AI suggestion</span></div>
        {transcript && <div className="transcript-cell">{transcriptCell(ticket, transcript, info.suggestion.meetingId)}</div>}
        <div className="row-actions" />
      </div>
    );
  };

  return (
    <div className="table-scroll" ref={scrollRef} style={gridStyle} onMouseLeave={() => onHover(null)}>
      <div className="ticket-grid ticket-head" role="row">
        <div className="check-cell"><input type="checkbox" aria-label="Select all" /></div>
        {shown.map((column) => (
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
      {rows.length ? rows.map((ticket, rowIndex) => review?.rows.has(ticket.id) ? reviewRow(ticket, review.rows.get(ticket.id)!, rowIndex) : (
        <div
          role="row"
          className={`ticket-grid ticket-row ${selectedId === ticket.id ? "selected" : ""} ${hoveredId === ticket.id ? `hovered ${typeClass(ticket.type)}` : ""}`}
          key={ticket.id}
          data-ticket-id={ticket.id}
          onMouseEnter={() => onHover(ticket.id)}
          onClick={() => onSelect(ticket)}
        >
          <div className="check-cell">
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
          <div>{deadline(ticket)}</div>
          {/* Clicking anywhere in the Map cell opens the map panel. */}
          {onShowOnMap
            ? <div className="opens-panel" onClick={(event) => { event.stopPropagation(); onShowOnMap(ticket.id, 0); }}><LocationCell location={ticket.location} label={ticket.number} onChange={(location) => onChange(ticket.id, { location })} onShowOnMap={(index) => onShowOnMap(ticket.id, index)} /></div>
            : <div><LocationCell location={ticket.location} label={ticket.number} onChange={(location) => onChange(ticket.id, { location })} /></div>}
          <div>{text(ticket, "summary", "Summary", 3)}</div>
          <div><span className={`tag source ${ticket.source}`}>{sourceLabel[ticket.source] ?? ticket.source}</span></div>
          {transcript && <div className="transcript-cell">{transcriptCell(ticket, transcript)}</div>}
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
