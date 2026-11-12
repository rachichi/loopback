// The Meetings tab's three sections side by side. Open sections share the width equally; the rest are slim
// vertical rails. At least one stays open. Rails and headers drag to reorder. The order is remembered; the open sections are not: a meeting opens with the transcript and whatever is already generated, so a generated meeting shows all three.
import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { ChevronsRight, Info } from "lucide-react";

export type SectionKey = "transcript" | "tickets" | "minutes";
export type SectionDef = { key: SectionKey; label: string; icon: ReactNode; content: ReactNode; locked: boolean; badge?: number; info?: { text: string; href: string } };

type Layout = { order: SectionKey[]; open: SectionKey[] };
const STORAGE_KEY = "loopback.meetingSections";
const fallback: Layout = { order: ["transcript", "tickets", "minutes"], open: ["transcript"] };

/** The remembered order. Open to start: the transcript plus every section that is already generated (not locked). */
function loadLayout(unlocked: SectionKey[]): Layout {
  const open = fallback.order.filter((key) => key === "transcript" || unlocked.includes(key));
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Layout | null;
    if (stored && Array.isArray(stored.order) && stored.order.length === 3 && stored.order.every((key) => fallback.order.includes(key))) return { order: stored.order, open };
  } catch { /* fall back */ }
  return { ...fallback, open };
}

export default function Sections({ sections, request }: {
  sections: SectionDef[];
  /** Open sections from outside (a highlight click, a finished Generate). A new n repeats the request. */
  request: { keys: SectionKey[]; n: number } | null;
}) {
  const [layout, setLayout] = useState(() => loadLayout(sections.filter((section) => !section.locked).map((section) => section.key)));
  const [dragging, setDragging] = useState<SectionKey | null>(null);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: layout.order })); }, [layout]);
  // Sections a request has just opened grow in rather than appearing (see .opening in index.css).
  const [opening, setOpening] = useState<SectionKey[]>([]);
  useEffect(() => {
    if (!request) return;
    const added = request.keys.filter((key) => !layout.open.includes(key));
    if (!added.length) return;
    setLayout((current) => ({ ...current, open: [...current.open, ...added.filter((key) => !current.open.includes(key))] }));
    setOpening(added);
    const timer = window.setTimeout(() => setOpening([]), 900);
    return () => window.clearTimeout(timer);
  }, [request?.n]);

  const toggle = (key: SectionKey) => setLayout((current) => {
    if (!current.open.includes(key)) return { ...current, open: [...current.open, key] };
    // The last open section can't collapse.
    return current.open.length === 1 ? current : { ...current, open: current.open.filter((item) => item !== key) };
  });
  const dropOn = (target: SectionKey) => {
    if (!dragging || dragging === target) return;
    setLayout((current) => {
      const order = current.order.filter((key) => key !== dragging);
      order.splice(current.order.indexOf(target), 0, dragging);
      return { ...current, order };
    });
  };
  const dragProps = (key: SectionKey) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => { event.dataTransfer.effectAllowed = "move"; setDragging(key); },
    onDragEnd: () => setDragging(null),
  });

  const byKey = new Map(sections.map((section) => [section.key, section]));
  const only = layout.open.length === 1;
  return (
    <div className="meeting-sections">
      {layout.order.map((key) => {
        const section = byKey.get(key)!;
        const open = layout.open.includes(key);
        const target = {
          onDragOver: (event: DragEvent) => { if (dragging) event.preventDefault(); },
          onDrop: (event: DragEvent) => { event.preventDefault(); dropOn(key); setDragging(null); },
        };
        const state = `${section.locked ? "locked" : ""} ${dragging === key ? "dragging" : ""} ${opening.includes(key) ? "opening" : ""}`;
        if (!open) {
          return (
            <button key={key} type="button" className={`section-rail ${state}`} aria-label={`Open ${section.label}`} title={`Open ${section.label}`} onClick={() => toggle(key)} {...dragProps(key)} {...target}>
              {section.icon}
              <span className="section-rail-label">{section.label}</span>
              {section.badge ? <span className="tab-count">{section.badge}</span> : null}
            </button>
          );
        }
        return (
          <section key={key} className={`meeting-section ${state}`} aria-label={section.label} {...target}>
            <header className="section-head" {...dragProps(key)} title="Drag to reorder">
              <span>{section.icon} {section.label}{section.badge ? <span className="tab-count">{section.badge}</span> : null}{section.info && <a className="section-info" href={section.info.href} target="_blank" rel="noopener noreferrer" aria-label={section.info.text} title={section.info.text} onClick={(event) => event.stopPropagation()}><Info size={14} /></a>}</span>
              <button type="button" aria-label={`Collapse ${section.label}`} title={only ? "At least one section stays open" : `Collapse ${section.label}`} disabled={only} onClick={() => toggle(key)}><ChevronsRight size={15} /></button>
            </header>
            <div className="section-body">
              {section.content}
              {section.locked && <div className="section-lock" aria-label={`${section.label} unlocks after Generate Tickets and Minutes`} title="Unlocks after Generate Tickets and Minutes" />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
