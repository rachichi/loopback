// The Meetings tab (meetings_tab). Loaded with React.lazy, so it, TranscriptView, the paragraph code and the
// minutes editor stay out of the main bundle.
//
// With no meeting chosen it shows the table of meetings; with one, that meeting's transcript, tickets and
// minutes side by side. The ticket table is the Tickets tab's, on the same state, so approving, rejecting
// or editing here changes the Tickets tab too.
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, ListChecks, NotebookText, Sparkles, X } from "lucide-react";
import TicketTable, { type ReviewRows, type RowHeight, type TranscriptColumn } from "../../TicketTable";
import { inTab, UrgencyTabs, type UrgencyTab } from "../../TicketFilters";
import TranscriptView from "../../TranscriptView";
import { buildParagraphs, type Paragraph } from "../../transcript";
import { useTypeClass } from "../../lib/board";
import type { EvidenceSpan, Ticket } from "../tickets/types";
import { loadTranscript } from "../transcript/api";
import { expectedSeconds, progressAt } from "../transcript/progress";
import { reviewId } from "../transcript/review";
import type { MeetingInfo, Suggestion, TranscriptMeeting } from "../transcript/types";
import MeetingsList from "./MeetingsList";
import Sections, { type SectionKey } from "./Sections";

const MinutesEditor = lazy(() => import("./MinutesEditor"));

export type MeetingsPageProps = {
  meetings: MeetingInfo[];
  /** The meeting shown, or null for the table of meetings. */
  meetingId: string | null;
  onOpenMeeting: (meetingId: string | null) => void;
  tickets: Ticket[];
  /** Tickets with pending suggestions folded in (withReviewRows), as the Tickets tab shows them. */
  rows: Ticket[];
  suggestions: Suggestion[];
  review: ReviewRows | undefined;
  selectedId: string;
  hoveredId: string | null;
  followHover: boolean;
  rowHeight: RowHeight;
  onHover: (id: string | null) => void;
  onSelect: (ticket: Ticket) => void;
  onExpand: (ticket: Ticket) => void;
  onChange: (id: string, patch: Partial<Ticket>) => void;
  onDelete: (tickets: Ticket[]) => void;
  onSpanChange: (ticketId: string, index: number, span: EvidenceSpan) => void;
  canEdit: boolean;
  /** Runs whatever of tickets and minutes is not generated yet, then refreshes the meetings. */
  onGenerate: (meetingId: string) => Promise<void>;
  /** The minutes were edited or copied. */
  onMinutesEvent: (event: "edited" | "copied") => void;
  /** Meetings were opened; fires once per meeting view for analytics. */
  onViewed: () => void;
};

/** A stand-in ticket holding only a pending suggestion's highlights, so TranscriptView can draw them. */
function standIn(suggestion: Suggestion, ticket: Ticket | undefined): Ticket {
  return {
    id: reviewId(suggestion),
    number: ticket?.number ?? "New",
    title: `Suggested: ${suggestion.changes.title ?? ticket?.title ?? ""}`,
    type: suggestion.changes.type ?? ticket?.type ?? "Other",
    status: "Open", location: { text: "", places: [] }, requester: "", summary: "", urgent: false, deadline: "",
    submittedBy: "", submittedAt: "", ownerId: null, source: "transcript", closedAt: null, createdBy: null, evidence: {},
    meetingIds: [suggestion.meetingId],
    spans: suggestion.spans,
  };
}

/** Length from the transcript's word count at a typical speaking rate. The meetings table has no duration. */
function estimatedLength(paragraphs: Paragraph[]): string {
  const words = paragraphs.reduce((total, paragraph) => total + paragraph.text.split(/\s+/).filter(Boolean).length, 0);
  const minutes = Math.max(1, Math.round(words / 130 / 5) * 5);
  return minutes < 60 ? `~${minutes} min` : `~${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}

const dateLabel = (heldOn: string) => {
  const [year, month, day] = heldOn.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
};

export default function MeetingsPage(props: MeetingsPageProps) {
  const { meetings, meetingId, onOpenMeeting, tickets, suggestions } = props;
  // Kept here, not in the meeting view, so a jump into another meeting survives that view mounting.
  const [jump, setJump] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  const info = meetings.find((meeting) => meeting.id === meetingId);
  if (!info) {
    return (
      <>
        <div className="title-band meeting-band">
          <div><h1>Meetings</h1><span>Open a meeting to see its transcript, tickets and minutes</span></div>
        </div>
        <MeetingsList meetings={meetings} tickets={tickets} suggestions={suggestions} onOpen={onOpenMeeting} />
      </>
    );
  }
  return <MeetingDetail key={info.id} info={info} jump={jump} setJump={setJump} {...props} />;
}

function MeetingDetail({ info, jump, setJump, onOpenMeeting, meetings, tickets, rows, suggestions, review, selectedId, hoveredId, followHover, rowHeight, onHover, onSelect, onExpand, onChange, onDelete, onSpanChange, canEdit, onGenerate, onMinutesEvent, onViewed }: MeetingsPageProps & { info: MeetingInfo; jump: { id: string | null; n: number }; setJump: React.Dispatch<React.SetStateAction<{ id: string | null; n: number }>> }) {
  const typeClass = useTypeClass();
  useEffect(onViewed, []);

  const [paragraphs, setParagraphs] = useState<Paragraph[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadTranscript(info.id)
      .then((text) => { if (!cancelled) setParagraphs(buildParagraphs(text)); })
      .catch((error) => { console.error(error); if (!cancelled) setLoadError("Couldn't load this transcript."); });
    return () => { cancelled = true; };
  }, [info.id]);

  const ticketsReady = Boolean(info.matchedAt);
  const minutesReady = Boolean(info.minutesAt);
  const generated = ticketsReady && minutesReady;
  // Whatever is already generated is left alone, so the button names only what it will make.
  const generateLabel = ticketsReady ? "Generate Minutes" : minutesReady ? "Generate Tickets" : "Generate Tickets and Minutes";

  // Generate: one bar for both jobs, filling toward the expected length like the Transcript tab's button.
  const [running, setRunning] = useState<{ at: number; seconds: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [request, setRequest] = useState<{ key: SectionKey; n: number } | null>(null);
  useEffect(() => {
    if (!running) return;
    const tick = () => setProgress(progressAt((Date.now() - running.at) / 1000, running.seconds));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 12000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const generating = running !== null;
  const generate = async () => {
    const characters = paragraphs?.reduce((total, paragraph) => total + paragraph.text.length, 0) ?? 60000;
    setRunning({ at: Date.now(), seconds: expectedSeconds(characters) });
    setError(null);
    try {
      await onGenerate(info.id);
      setProgress(1);
      await new Promise((resolve) => setTimeout(resolve, 400));
      setToast(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't generate this meeting.");
    } finally {
      setRunning(null);
      setProgress(0);
    }
  };

  // The band's Generate button and the Minutes section's are one control: hovering either lights both,
  // and either one runs the same generate.
  const [linkedHover, setLinkedHover] = useState(false);
  const generateButton = (label: string) => (
    <button
      type="button"
      className={`generate meeting-generate ${generating ? "running" : ""} ${generated ? "done" : ""} ${linkedHover ? "linked-hover" : ""}`}
      disabled={generating || generated || !paragraphs}
      aria-busy={generating}
      onClick={generate}
      onMouseEnter={() => setLinkedHover(true)}
      onMouseLeave={() => setLinkedHover(false)}
      title={generated ? "Tickets and minutes were already generated for this meeting" : `Draft ${ticketsReady ? "meeting minutes" : minutesReady ? "tickets" : "tickets and meeting minutes"} from the transcript`}
    >
      {generating && <span className="generate-fill" style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }} aria-hidden="true" />}
      <Sparkles size={16} color={generated ? "#9aa1aa" : "url(#generate-ombre)"} />
      <span className="generate-label">{generating ? "Generating…" : generated ? "Generated" : label}</span>
    </button>
  );

  const byId = useMemo(() => new Map(tickets.map((ticket) => [ticket.id, ticket])), [tickets]);
  const inMeeting = suggestions.filter((suggestion) => suggestion.meetingId === info.id);
  const standIns = inMeeting.map((suggestion) => standIn(suggestion, suggestion.ticketId ? byId.get(suggestion.ticketId) : undefined));
  const pendingIds = useMemo(() => new Set(standIns.map((ticket) => ticket.id)), [inMeeting.map((s) => s.id).join()]);
  // Tickets linked to the meeting, plus its pending suggestions. Greyed out until the AI run is done.
  const meetingRows = useMemo(() => rows.filter((ticket) => ticket.meetingIds.includes(info.id)), [rows, info.id]);

  // The same urgency and Review tabs as the Tickets tab, counting only this meeting's tickets.
  const [urgency, setUrgency] = useState<UrgencyTab>("all");
  const inReview = (id: string) => review?.rows.has(id) ?? false;
  const shownRows = ticketsReady ? meetingRows.filter((ticket) => inTab(ticket, urgency, inReview)) : [];
  const select = (ticket: Ticket) => { onSelect(ticket); setJump((current) => ({ id: ticket.id, n: current.n + 1 })); };
  // The table's Transcript column, as on the Tickets tab: a tag per meeting the ticket was discussed in.
  // A tag for this meeting scrolls to the ticket's highlights; a tag for another meeting opens that meeting there.
  const labels = useMemo(() => new Map(meetings.map((meeting) => [meeting.id, meeting.label])), [meetings]);
  const transcriptColumn: TranscriptColumn = {
    meetingLabel: (id) => labels.get(id),
    onShow: (rowId, id) => {
      onHover(null);
      const ticket = rows.find((row) => row.id === rowId);
      if (ticket) onSelect(ticket);
      setJump((current) => ({ id: rowId, n: current.n + 1 }));
      if (id !== info.id) onOpenMeeting(id);
    },
  };

  const meeting: TranscriptMeeting | null = paragraphs ? { id: info.id, title: info.title, label: info.label, date: info.heldOn, paragraphs } : null;
  // Clicking highlighted text opens the Tickets section and selects that ticket's row.
  const openFromHighlight = (ticketId: string) => {
    const ticket = rows.find((row) => row.id === ticketId);
    if (ticket) onSelect(ticket);
    setRequest((current) => ({ key: "tickets", n: (current?.n ?? 0) + 1 }));
  };
  const transcript = meeting
    ? <TranscriptView key={meeting.id} bare meetings={meetings} meeting={meeting} onMeetingChange={onOpenMeeting} tickets={[...tickets, ...standIns]} hoveredId={hoveredId} onHover={onHover} onSpanChange={onSpanChange} jump={jump} typeClass={typeClass} pendingIds={pendingIds} onHighlightClick={openFromHighlight} />
    : <div className="transcript-empty">{loadError ?? "Loading transcript…"}</div>;

  const sections = [
    { key: "transcript" as const, label: "Transcript", icon: <FileText size={15} />, content: transcript, locked: false },
    {
      key: "tickets" as const, label: "Tickets", icon: <ListChecks size={15} />, locked: !ticketsReady, badge: inMeeting.length,
      content: (
        <>
          {!ticketsReady && canEdit && <div className="section-generate">{generateButton("Generate Tickets")}</div>}
          <UrgencyTabs tab={urgency} setTab={setUrgency} tickets={ticketsReady ? meetingRows : []} inReview={inReview} showReview={review !== undefined} />
          <TicketTable rows={shownRows} selectedId={selectedId} emptyMessage={urgency === "review" ? "Nothing to review from this meeting." : "No tickets from this meeting yet."} hoveredId={hoveredId} followHover={followHover} rowHeight={rowHeight} onHover={onHover} onSelect={select} onExpand={onExpand} onChange={onChange} onDelete={onDelete} transcript={transcriptColumn} review={review} />
        </>
      ),
    },
    {
      key: "minutes" as const, label: "Minutes", icon: <NotebookText size={15} />, locked: !minutesReady,
      content: minutesReady
        ? <Suspense fallback={<div className="transcript-empty">Loading minutes…</div>}><MinutesEditor meetingId={info.id} canEdit={canEdit} onCopied={() => onMinutesEvent("copied")} onEdited={() => onMinutesEvent("edited")} /></Suspense>
        : <div className="minutes-placeholder">
          <h2>Meeting minutes</h2>
          <p>The draft minutes appear here.</p>
          {canEdit && <div className="section-generate">{generateButton("Generate Minutes")}</div>}
        </div>,
    },
  ];

  return (
    <>
      <div className="title-band meeting-band">
        <div className="meeting-heading">
          <h1>
            <button type="button" className="crumb" onClick={() => onOpenMeeting(null)}>Meetings</button>
            <ChevronRight className="crumb-sep" size={28} aria-hidden="true" />
            <span title={info.title}>{info.title}</span>
          </h1>
          <span>{dateLabel(info.heldOn)}{paragraphs ? ` · ${estimatedLength(paragraphs)}` : ""}</span>
        </div>
        {canEdit && generateButton(generateLabel)}
        <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="generate-ombre" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3fd8b4" /><stop offset=".55" stopColor="#2bb7d5" /><stop offset="1" stopColor="#8a63b5" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {error && <div className="meeting-error" role="alert">{error}</div>}
      <main className="meeting-workspace">
        <Sections sections={sections} request={request} />
      </main>
      {toast && (
        <div className="meeting-toast" role="status">
          <strong>Tickets and minutes are ready.</strong>
          <span>Check the tickets and the draft minutes before they go out.</span>
          <div>
            <button type="button" onClick={() => setRequest((current) => ({ key: "tickets", n: (current?.n ?? 0) + 1 }))}>Open tickets</button>
            <button type="button" onClick={() => setRequest((current) => ({ key: "minutes", n: (current?.n ?? 0) + 1 }))}>Open minutes</button>
          </div>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToast(false)}><X size={14} /></button>
        </div>
      )}
    </>
  );
}
