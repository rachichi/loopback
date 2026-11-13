// The Transcript tab of the right panel (transcript_matching). Loaded with React.lazy, so this file,
// TranscriptView and the paragraph code stay out of the main bundle for boards without the flag.
//
// Generate runs match-transcript on the shown meeting. Its suggestions are reviewed
// in the ticket table's Review tab; here they are underlined in the transcript, with the same ids as their
// table rows, so hovering either one lights up the other.
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import TranscriptView from "../../TranscriptView";
import { buildParagraphs, type Paragraph } from "../../transcript";
import { useTypeClass } from "../../lib/board";
import type { EvidenceSpan, Ticket } from "../tickets/types";
import { loadTranscript } from "./api";
import { expectedSeconds, progressAt } from "./progress";
import { reviewId } from "./review";
import type { MeetingInfo, Suggestion, TranscriptMeeting } from "./types";

/** A stand-in ticket holding only a pending suggestion's highlights, so TranscriptView can draw them. */
function standIn(suggestion: Suggestion, ticket: Ticket | undefined): Ticket {
  return {
    id: reviewId(suggestion),
    number: ticket?.number ?? "New",
    title: `Suggested: ${suggestion.changes.title ?? ticket?.title ?? ""}`,
    type: suggestion.changes.type ?? ticket?.type ?? "Other",
    status: "Open", location: { text: "", places: [] }, requester: "", contactName: "", contactPhone: "", contactEmail: "", actionsTaken: "", agency: "", serviceRequestNumber: "", dateOpened: "", summary: "", urgent: false, deadline: "",
    submittedBy: "", submittedAt: "", ownerId: null, source: "transcript", closedAt: null, createdBy: null, evidence: {},
    meetingIds: [suggestion.meetingId],
    spans: suggestion.spans,
  };
}

export default function TranscriptPanel({
  meetings,
  meetingId,
  onMeetingChange,
  tickets,
  suggestions,
  hoveredId,
  onHover,
  onSpanChange,
  jump,
  canEdit,
  onRunMatching,
}: {
  /** The board's meetings, newest first. */
  meetings: MeetingInfo[];
  meetingId: string;
  onMeetingChange: (meetingId: string) => void;
  tickets: Ticket[];
  /** Every pending suggestion on the board; the panel highlights the shown meeting's. */
  suggestions: Suggestion[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSpanChange: (ticketId: string, index: number, span: EvidenceSpan) => void;
  /** Scroll to a ticket's (or review row's) first highlight in a meeting. A new n repeats the jump. */
  jump: { id: string | null; meetingId: string | null; n: number };
  canEdit: boolean;
  onRunMatching: (meetingId: string) => Promise<void>;
}) {
  const typeClass = useTypeClass();
  const info = meetings.find((meeting) => meeting.id === meetingId) ?? meetings[0];

  // Transcripts are loaded one at a time, when shown, and kept for the session.
  const [paragraphs, setParagraphs] = useState<Map<string, Paragraph[]>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    if (!info || paragraphs.has(info.id)) return;
    let cancelled = false;
    setLoadError(null);
    loadTranscript(info.id)
      .then((text) => { if (!cancelled) setParagraphs((current) => new Map(current).set(info.id, buildParagraphs(text))); })
      .catch((error) => { console.error(error); if (!cancelled) setLoadError("Couldn't load this transcript."); });
    return () => { cancelled = true; };
  }, [info?.id]);

  // Jumps come from the table: a Transcript tag, or selecting a row.
  const jumps = useRef(0);
  const [jumpTo, setJumpTo] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  useEffect(() => {
    if (jump.id && jump.meetingId === info?.id) setJumpTo({ id: jump.id, n: ++jumps.current });
  }, [jump.n]);
  const changeMeeting = (id: string) => {
    setJumpTo({ id: null, n: ++jumps.current });
    onMeetingChange(id);
  };

  // While Generate runs, the button fills like a progress bar toward the run's expected length.
  const [running, setRunning] = useState<{ at: number; seconds: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [matchError, setMatchError] = useState<string | null>(null);
  useEffect(() => {
    if (!running) return;
    const tick = () => setProgress(progressAt((Date.now() - running.at) / 1000, running.seconds));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [running]);
  const matching = running !== null;

  const byId = useMemo(() => new Map(tickets.map((ticket) => [ticket.id, ticket])), [tickets]);
  const inMeeting = suggestions.filter((suggestion) => suggestion.meetingId === info?.id);
  const standIns = inMeeting.map((suggestion) => standIn(suggestion, suggestion.ticketId ? byId.get(suggestion.ticketId) : undefined));
  const pendingIds = useMemo(() => new Set(standIns.map((ticket) => ticket.id)), [inMeeting.map((s) => s.id).join()]);

  if (!info) return <div className="transcript-empty">No transcripts for this board yet. They appear here about a day after a meeting.</div>;
  const shown = paragraphs.get(info.id);
  if (!shown) return <div className="transcript-empty">{loadError ?? "Loading transcript…"}</div>;
  const meeting: TranscriptMeeting = { id: info.id, title: info.title, label: info.label, date: info.heldOn, paragraphs: shown };

  const run = async () => {
    const replaces = inMeeting.length ? ` This replaces its ${inMeeting.length} suggestion${inMeeting.length === 1 ? "" : "s"} waiting in Review.` : "";
    if (info.matchedAt && !window.confirm(`This meeting was already generated on ${new Date(info.matchedAt).toLocaleDateString()}. Generate again?${replaces}`)) return;
    setRunning({ at: Date.now(), seconds: expectedSeconds(shown.reduce((total, paragraph) => total + paragraph.text.length, 0)) });
    setMatchError(null);
    try {
      await onRunMatching(info.id);
      // Show the bar full for a moment before the button resets.
      setProgress(1);
      await new Promise((resolve) => setTimeout(resolve, 400));
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : "Couldn't match this meeting.");
    } finally {
      setRunning(null);
      setProgress(0);
    }
  };

  // A meeting that was already generated keeps a greyed-out button; it still runs again, after a confirm.
  const done = Boolean(info.matchedAt) && !matching;

  // The sparkle takes the same teal-to-blue-to-purple gradient as the label (.generate in index.css).
  const button = canEdit && (
    <button
      type="button"
      className={`generate ${matching ? "running" : ""} ${done ? "done" : ""}`}
      disabled={matching}
      aria-busy={matching}
      onClick={run}
      title={matching
        ? "Reading the transcript against the board's open tickets"
        : `Match this transcript to the board's open tickets and draft tickets for anything new. Results go to the Review tab.${info.matchedAt ? ` Generated ${new Date(info.matchedAt).toLocaleString()}; generating again replaces the suggestions still in Review.` : ""}`}
    >
      {matching && <span className="generate-fill" style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }} aria-hidden="true" />}
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="generate-ombre" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3fd8b4" />
            <stop offset=".55" stopColor="#2bb7d5" />
            <stop offset="1" stopColor="#8a63b5" />
          </linearGradient>
        </defs>
      </svg>
      <Sparkles size={15} color={done ? "#9aa1aa" : "url(#generate-ombre)"} />
      <span className="generate-label">{matching ? "Generating…" : done ? "Generated" : "Generate"}</span>
    </button>
  );

  const updates = inMeeting.filter((suggestion) => suggestion.kind === "update").length;
  const status = matching
    ? <span>Reading the transcript against the board's open tickets. This takes up to a minute.</span>
    : matchError
      ? <span className="match-error" role="alert">{matchError}</span>
      : inMeeting.length
        ? <span>{updates} updated and {inMeeting.length - updates} new ticket{inMeeting.length - updates === 1 ? "" : "s"} from this meeting are waiting in the Review tab. Their paragraphs are underlined below.</span>
        : info.matchedAt
          ? <span>Matched {new Date(info.matchedAt).toLocaleDateString()}. Nothing left to review from this meeting.</span>
          : <span>Not matched yet.</span>;

  return (
    <TranscriptView
      key={meeting.id}
      meetings={meetings}
      meeting={meeting}
      onMeetingChange={changeMeeting}
      tickets={[...tickets, ...standIns]}
      hoveredId={hoveredId}
      onHover={onHover}
      onSpanChange={onSpanChange}
      jump={jumpTo}
      typeClass={typeClass}
      pendingIds={pendingIds}
      pickerAction={button}
      aside={<div className="match-status">{status}</div>}
    />
  );
}
