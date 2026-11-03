// The Transcript tab of the right panel (transcript_matching). Loaded with React.lazy, so this file,
// TranscriptView and the paragraph code stay out of the main bundle for boards without the flag.
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import TranscriptView from "../../TranscriptView";
import { buildParagraphs, type Paragraph } from "../../transcript";
import { useBoard, useTypeClass } from "../../lib/board";
import type { EvidenceSpan, Ticket } from "../tickets/types";
import { loadTranscript } from "./api";
import SuggestionCard from "./SuggestionCard";
import type { MeetingInfo, Suggestion, SuggestionChanges, TranscriptMeeting } from "./types";

/** Pending suggestions are drawn in the transcript as stand-in tickets with these ids. */
const pendingId = (suggestion: Suggestion) => `suggestion:${suggestion.id}`;

/** A stand-in ticket for a suggestion, so TranscriptView can highlight its paragraphs. */
function standIn(suggestion: Suggestion, ticket: Ticket | undefined): Ticket {
  const base: Ticket = ticket ?? {
    id: "", number: "", title: "", type: "Other", status: "Open", location: { text: "", places: [] }, summary: "",
    urgent: false, deadline: "", submittedBy: "", submittedAt: "", meetingIds: [], spans: [], ownerId: null,
    source: "transcript", closedAt: null, createdBy: null, evidence: {}, requester: "",
  };
  return {
    ...base,
    id: pendingId(suggestion),
    number: ticket ? ticket.number : "New",
    title: `Suggested: ${suggestion.changes.title ?? base.title}`,
    type: suggestion.changes.type ?? base.type,
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
  focusTicketId,
  onClearFocus,
  hoveredId,
  onHover,
  onSpanChange,
  jump,
  canEdit,
  onRunMatching,
  onApprove,
  onReject,
}: {
  /** The board's meetings, newest first. */
  meetings: MeetingInfo[];
  meetingId: string;
  onMeetingChange: (meetingId: string) => void;
  tickets: Ticket[];
  /** Every pending suggestion on the board; the panel shows the current meeting's. */
  suggestions: Suggestion[];
  /** When set, only this ticket's suggestions are listed. */
  focusTicketId: string | null;
  onClearFocus: () => void;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSpanChange: (ticketId: string, index: number, span: EvidenceSpan) => void;
  /** Scroll to a ticket's first highlight in a meeting. A new n repeats the jump. */
  jump: { id: string | null; meetingId: string | null; n: number };
  canEdit: boolean;
  onRunMatching: (meetingId: string) => Promise<void>;
  onApprove: (suggestion: Suggestion, edited: SuggestionChanges | null) => Promise<void>;
  onReject: (suggestion: Suggestion) => Promise<void>;
}) {
  const { ticketTypes } = useBoard();
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

  // Jumps come from the table (a ticket's Transcript tag) or from a suggestion card here.
  const jumps = useRef(0);
  const [jumpTo, setJumpTo] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  useEffect(() => {
    if (jump.id && jump.meetingId === info?.id) setJumpTo({ id: jump.id, n: ++jumps.current });
  }, [jump.n]);
  const changeMeeting = (id: string) => {
    setJumpTo({ id: null, n: ++jumps.current });
    onMeetingChange(id);
  };

  const [cardHover, setCardHover] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(tickets.map((ticket) => [ticket.id, ticket])), [tickets]);
  const inMeeting = suggestions.filter((suggestion) => suggestion.meetingId === info?.id);
  const listed = focusTicketId ? inMeeting.filter((suggestion) => suggestion.ticketId === focusTicketId) : inMeeting;
  const standIns = inMeeting.map((suggestion) => standIn(suggestion, suggestion.ticketId ? byId.get(suggestion.ticketId) : undefined));
  const pendingIds = useMemo(() => new Set(standIns.map((ticket) => ticket.id)), [inMeeting.map((s) => s.id).join()]);

  if (!info) return <div className="transcript-empty">No transcripts for this board yet. They appear here about a day after a meeting.</div>;
  const shown = paragraphs.get(info.id);
  if (!shown) return <div className="transcript-empty">{loadError ?? "Loading transcript…"}</div>;
  const meeting: TranscriptMeeting = { id: info.id, title: info.title, label: info.label, date: info.heldOn, paragraphs: shown };

  const run = async () => {
    if (inMeeting.length && !window.confirm(`Find ticket updates again? This replaces the ${inMeeting.length} pending suggestion${inMeeting.length === 1 ? "" : "s"} for this meeting.`)) return;
    setMatching(true);
    setMatchError(null);
    try {
      await onRunMatching(info.id);
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : "Couldn't find ticket updates.");
    } finally {
      setMatching(false);
    }
  };

  const actions = canEdit && (
    <button type="button" className="find-updates" disabled={matching} onClick={run} title={info.matchedAt ? `Last run ${new Date(info.matchedAt).toLocaleString()}` : "Read this transcript against the board's open tickets"}>
      <Sparkles size={13} /> {matching ? "Reading transcript…" : info.matchedAt ? "Find again" : "Find ticket updates"}
    </button>
  );

  const aside = (
    <section className="suggestions" aria-label="Suggestions to review">
      <div className="suggestions-heading">
        <strong>{listed.length ? `${listed.length} suggestion${listed.length === 1 ? "" : "s"} to review` : info.matchedAt ? "No suggestions to review" : "Not read yet"}</strong>
        {focusTicketId && <button type="button" onClick={onClearFocus}>Show all for this meeting</button>}
        {matchError && <span className="suggestions-error" role="alert">{matchError}</span>}
      </div>
      {listed.length > 0 && (
        <ul>
          {listed.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              ticket={suggestion.ticketId ? byId.get(suggestion.ticketId) : undefined}
              ticketTypes={ticketTypes.map((type) => type.label)}
              typeClass={typeClass}
              active={cardHover === pendingId(suggestion)}
              canEdit={canEdit}
              onHover={(on) => setCardHover(on ? pendingId(suggestion) : null)}
              onShow={() => setJumpTo({ id: pendingId(suggestion), n: ++jumps.current })}
              onApprove={(edited) => onApprove(suggestion, edited)}
              onReject={() => onReject(suggestion)}
            />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <TranscriptView
      key={meeting.id}
      meetings={meetings}
      meeting={meeting}
      onMeetingChange={changeMeeting}
      tickets={[...tickets, ...standIns]}
      hoveredId={cardHover ?? hoveredId}
      onHover={(id) => {
        if (id?.startsWith("suggestion:")) setCardHover(id);
        else { setCardHover(null); onHover(id); }
      }}
      onSpanChange={onSpanChange}
      jump={jumpTo}
      typeClass={typeClass}
      pendingIds={pendingIds}
      actions={actions}
      aside={aside}
    />
  );
}
