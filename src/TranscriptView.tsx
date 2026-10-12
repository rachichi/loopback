import { useEffect, useRef, useState, type ReactNode } from "react";
import { meetingTitle, typeClass, type Ticket } from "./goldTickets";
import { normalizeSpan, paragraphIndexAt, paragraphs, type Span } from "./transcript";

type Drag = { ticketId: string; index: number; edge: "start" | "end" };
type Placed = { ticket: Ticket; index: number; span: Span };

/** Global transcript offset under the pointer, or null when it isn't over transcript text. */
function offsetFromPoint(x: number, y: number): number | null {
  let node: Node | null = null;
  let offset = 0;
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) { node = pos.offsetNode; offset = pos.offset; }
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range) { node = range.startContainer; offset = range.startOffset; }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const segment = node.parentElement?.closest<HTMLElement>("[data-start]");
  return segment ? Number(segment.dataset.start) + offset : null;
}

export default function TranscriptView({
  tickets,
  hoveredId,
  onHover,
  onSpanChange,
  jump,
}: {
  tickets: Ticket[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSpanChange: (ticketId: string, index: number, span: Span) => void;
  jump: { id: string | null; n: number };
}) {
  const bodyRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // While dragging, the dragged ticket stays active even if the pointer crosses other highlights.
  const activeId = drag?.ticketId ?? hoveredId;
  // Leaving a highlight clears the hover after a short grace period, so the pointer
  // can cross a little plain text on its way to a drag handle.
  const clearTimer = useRef<number | undefined>(undefined);
  const hover = (id: string | null) => {
    if (drag) return;
    window.clearTimeout(clearTimer.current);
    if (id) onHover(id);
    else clearTimer.current = window.setTimeout(() => onHover(null), 350);
  };
  const keep = () => window.clearTimeout(clearTimer.current);
  useEffect(() => () => window.clearTimeout(clearTimer.current), []);

  // Scroll to the selected ticket's first highlight.
  useEffect(() => {
    const ticket = tickets.find((item) => item.id === jump.id);
    const body = bodyRef.current;
    if (!ticket?.spans.length || !body) return;
    const first = Math.min(...ticket.spans.map((span) => span.start));
    const target = body.querySelector<HTMLElement>(`[data-para="${paragraphs[paragraphIndexAt(first)].id}"]`);
    if (target) body.scrollTo({ top: target.offsetTop - 8, behavior: "smooth" });
    // Only re-run on a new jump request, not on every edit.
  }, [jump]);

  // Drag a highlight edge to the character under the pointer.
  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;
  useEffect(() => {
    if (!drag) return;
    document.body.classList.add("hl-dragging");
    const move = (event: MouseEvent) => {
      const offset = offsetFromPoint(event.clientX, event.clientY);
      const span = ticketsRef.current.find((item) => item.id === drag.ticketId)?.spans[drag.index];
      if (offset === null || !span) return;
      const next = drag.edge === "start"
        ? { start: Math.min(offset, span.end - 1), end: span.end }
        : { start: span.start, end: Math.max(offset, span.start + 1) };
      onSpanChange(drag.ticketId, drag.index, normalizeSpan(next));
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      document.body.classList.remove("hl-dragging");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag, onSpanChange]);

  const placed: Placed[] = tickets.flatMap((ticket) => ticket.spans.map((span, index) => ({ ticket, index, span })));

  const handle = (item: Placed, edge: "start" | "end") => (
    <span
      key={`${item.ticket.id}-${item.index}-${edge}`}
      className={`hl-handle ${edge} ${typeClass[item.ticket.type]}`}
      title={`Drag to adjust where this highlight ${edge === "start" ? "starts" : "ends"}`}
      onMouseEnter={keep}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDrag({ ticketId: item.ticket.id, index: item.index, edge });
      }}
    />
  );

  return (
    <div className="transcript-view">
      <header className="transcript-heading">
        <div><h2>{meetingTitle}</h2><p>Meeting transcript · hover a highlight and drag its ends to edit</p></div>
        <span>{paragraphs.length} paragraphs</span>
      </header>
      <ol className="transcript-body" ref={bodyRef} onMouseLeave={() => hover(null)}>
        {paragraphs.map((paragraph) => {
          const inside = placed.filter(({ span }) => span.start < paragraph.end && span.end > paragraph.start);
          // Cut the paragraph wherever a highlight starts or ends.
          const cuts = new Set([paragraph.start, paragraph.end]);
          for (const { span } of inside) {
            if (span.start > paragraph.start && span.start < paragraph.end) cuts.add(span.start);
            if (span.end > paragraph.start && span.end < paragraph.end) cuts.add(span.end);
          }
          const bounds = [...cuts].sort((a, b) => a - b);
          const pieces: ReactNode[] = [];
          for (let k = 0; k < bounds.length - 1; k++) {
            const [a, b] = [bounds[k], bounds[k + 1]];
            const text = paragraph.text.slice(a - paragraph.start, b - paragraph.start);
            const covering = inside.filter(({ span }) => span.start <= a && span.end >= b);
            if (covering.length) {
              const owner = covering.find(({ ticket }) => ticket.id === activeId) ?? covering[0];
              // Handles live inside the mark, pinned to its first and last character, so they
              // can never wrap onto a different line than the text they bound.
              const ends = covering.filter(({ ticket }) => ticket.id === activeId);
              pieces.push(
                <mark
                  key={a}
                  data-start={a}
                  className={`hl ${typeClass[owner.ticket.type]} ${owner.ticket.id === activeId ? "active" : ""}`}
                  title={covering.map(({ ticket }) => `${ticket.number} · ${ticket.title}`).join("\n")}
                  onMouseEnter={() => hover(owner.ticket.id)}
                >
                  {ends.filter(({ span }) => span.start === a).map((item) => handle(item, "start"))}
                  {text}
                  {ends.filter(({ span }) => span.end === b).map((item) => handle(item, "end"))}
                </mark>,
              );
            } else {
              pieces.push(<span key={a} data-start={a} onMouseEnter={() => hover(null)}>{text}</span>);
            }
          }
          return (
            <li key={paragraph.id} data-para={paragraph.id}>
              <span className="para-id">{paragraph.id}</span><p>{pieces}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
