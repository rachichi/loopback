// The Meetings tab's three sections side by side. Open sections share the width equally; the rest are slim
// vertical rails. At least one stays open. Rails and headers drag to reorder. The order is remembered; the open sections are not, so each meeting opens with only the transcript.
import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { ChevronsRight } from "lucide-react";

export type SectionKey = "transcript" | "tickets" | "minutes";
export type SectionDef = { key: SectionKey; label: string; icon: ReactNode; content: ReactNode; locked: boolean; badge?: number };

type Layout = { order: SectionKey[]; open: SectionKey[] };
const STORAGE_KEY = "loopback.meetingSections";
const fallback: Layout = { order: ["transcript", "tickets", "minutes"], open: ["transcript"] };

/** The remembered order, with only the transcript open: every meeting starts with Tickets and Minutes collapsed. */
function loadLayout(): Layout {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Layout | null;
    if (stored && Array.isArray(stored.order) && stored.order.length === 3 && stored.order.every((key) => fallback.order.includes(key))) return { order: stored.order, open: fallback.open };
  } catch { /* fall back */ }
  return fallback;
}

export default function Sections({ sections, request }: {
  sections: SectionDef[];
  /** Open a section from outside (the toast). A new n repeats the request. */
  request: { key: SectionKey; n: number } | null;
}) {
  const [layout, setLayout] = useState(loadLayout);
  const [dragging, setDragging] = useState<SectionKey | null>(null);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: layout.order })); }, [layout]);
  useEffect(() => {
    if (request) setLayout((current) => current.open.includes(request.key) ? current : { ...current, open: [...current.open, request.key] });
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
        const state = `${section.locked ? "locked" : ""} ${dragging === key ? "dragging" : ""}`;
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
              <span>{section.icon} {section.label}{section.badge ? <span className="tab-count">{section.badge}</span> : null}</span>
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
