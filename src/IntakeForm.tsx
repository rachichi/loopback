import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import LocationCell from "./LocationCell";
import DictateButton, { canDictate } from "./DictateButton";
import { fieldIcons, type EditableField } from "./TicketTable";
import { statuses, type Status, type Ticket } from "./features/tickets/types";
import { useBoard } from "./lib/board";

/** The fields a person fills in. The parent sets the id and submission date; the database assigns the
 *  number and sets submitted_by to the signed-in user. */
export type IntakeFields = Omit<Ticket, "id" | "number" | "meetingIds" | "spans" | "evidence" | "ownerId" | "source" | "closedAt" | "createdBy" | "requester" | "submittedBy" | "submittedAt">;

/** Dictated text is appended, so people can speak a field in several goes or fix a typed start. */
const append = (current: string, text: string) => (current.trim() ? `${current.trimEnd()} ${text}` : text);

const blank: IntakeFields = { title: "", type: "", urgent: false, deadline: "", location: { text: "", places: [] }, summary: "", status: "Open" };

/** One field: its icon and name on the left, the input on the right, as in an Airtable record. */
function Field({ field, label, children, asLabel = true }: { field: EditableField; label: string; children: ReactNode; asLabel?: boolean }) {
  const Icon = fieldIcons[field];
  const Row = asLabel ? "label" : "div";
  return (
    <Row className="form-field">
      <span className="form-field-name"><Icon size={14} aria-hidden="true" /> {label}</span>
      <div className="form-field-value">{children}</div>
    </Row>
  );
}

/** The ticket form, laid out like an Airtable record. Without a ticket it creates one (a request that arrives
 *  outside a meeting: email, call, walk-in). With a ticket it is the expanded view of that row, and every edit
 *  goes straight to the ticket, which the portal autosaves. */
export default function IntakeForm({
  ticket,
  onSubmit,
  onChange,
  onStep,
  page,
  banner,
  onClose,
}: {
  ticket?: Ticket;
  /** New ticket only. */
  onSubmit?: (fields: IntakeFields) => void;
  /** Expanded ticket only. */
  onChange?: (id: string, patch: Partial<Pick<Ticket, EditableField>>) => void;
  /** Expanded ticket only: move to the previous or next row, or undefined at either end. */
  onStep?: { prev?: () => void; next?: () => void };
  /** New ticket only: fill the screen instead of floating over the portal. */
  page?: boolean;
  /** Page mode: shown above the header, e.g. the board's name and logo. */
  banner?: ReactNode;
  onClose: () => void;
}) {
  const { ticketTypes } = useBoard();
  const [draft, setDraft] = useState<IntakeFields>(blank);
  const values: IntakeFields = ticket ?? draft;
  const set = (patch: Partial<IntakeFields>) => {
    if (ticket) onChange?.(ticket.id, patch);
    else setDraft((current) => ({ ...current, ...patch }));
  };
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, [ticket?.id]);
  useEffect(() => {
    if (page) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, page]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (ticket) return;
    onSubmit?.({
      ...draft,
      title: draft.title.trim(),
      // Type is optional on intake; an untyped request is filed as Other until someone triages it.
      type: draft.type || "Other",
      location: { ...draft.location, text: draft.location.places.map((place) => place.name).join("; ") },
      summary: draft.summary.trim(),
    });
  };

  return (
    <div className={`intake-backdrop ${page ? "page" : ""}`} onMouseDown={(event) => { if (!page && event.target === event.currentTarget) onClose(); }}>
      <form
        className={`intake-form ${ticket ? "expanded" : ""} ${page ? "page" : ""}`}
        role={page ? undefined : "dialog"}
        aria-modal={page ? undefined : "true"}
        {...(ticket ? { "aria-label": ticket.title || "Ticket" } : { "aria-labelledby": "intake-title" })}
        onSubmit={submit}
      >
        {page && banner}
        {ticket ? (
          <header className="intake-bar">
            <div className="intake-step">
              <button type="button" aria-label="Previous ticket" title="Previous ticket" disabled={!onStep?.prev} onClick={onStep?.prev}><ChevronUp size={16} /></button>
              <button type="button" aria-label="Next ticket" title="Next ticket" disabled={!onStep?.next} onClick={onStep?.next}><ChevronDown size={16} /></button>
            </div>
            <button type="button" aria-label="Close" onClick={onClose}><X size={16} /></button>
          </header>
        ) : (
          <header>
            <h2 id="intake-title">{page ? "Submit a ticket" : "New ticket"}</h2>
            <button type="button" aria-label="Close" onClick={onClose}><X size={16} /></button>
          </header>
        )}
        <div className="intake-body">
          <label className="intake-title-field">
            <span className="form-field-name">
              <fieldIcons.title size={14} aria-hidden="true" /> Title {!ticket && <em>required</em>}
            </span>
            <div className="dictate-field">
              <textarea
                ref={titleRef}
                rows={1}
                required
                value={values.title}
                onChange={(event) => set({ title: event.target.value })}
                // Enter adds the ticket instead of a new line; titles are one line.
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                placeholder="e.g. Broken streetlight on Avenue B"
              />
              <DictateButton label="Title" onText={(text) => set({ title: append(values.title, text) })} />
            </div>
          </label>
          <div className="intake-fields">
            <Field field="type" label="Type">
              <select value={values.type} onChange={(event) => set({ type: event.target.value })}>
                {!ticket && <option value="">Not sure yet</option>}
                {ticketTypes.map((item) => <option key={item.label} title={item.definition}>{item.label}</option>)}
                {/* Keep a type the board no longer defines selectable, so the select doesn't misreport it. */}
                {ticket && !ticketTypes.some((item) => item.label === ticket.type) && <option>{ticket.type}</option>}
              </select>
            </Field>
            <Field field="status" label="Status">
              <select value={values.status} onChange={(event) => set({ status: event.target.value as Status })}>
                {statuses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field field="urgent" label="Urgent">
              <input type="checkbox" className="intake-check" checked={values.urgent} onChange={(event) => set({ urgent: event.target.checked })} />
            </Field>
            <Field field="deadline" label="Deadline">
              <input type="date" className="intake-date" value={values.deadline} onChange={(event) => set({ deadline: event.target.value })} />
            </Field>
            <Field field="location" label="Map" asLabel={false}>
              <div className="intake-map">
                <LocationCell warningText location={values.location} label={ticket ? ticket.title || "the ticket" : "the new ticket"} onChange={(location) => set({ location })} />
                {!values.location.text.trim() && !values.location.crossStreets && !values.location.places.length && <p className="intake-map-hint">Add an address or cross streets so this ticket shows on the map.</p>}
              </div>
            </Field>
            <Field field="summary" label="Summary">
              <div className="dictate-field">
                <textarea rows={5} value={values.summary} onChange={(event) => set({ summary: event.target.value })} placeholder={canDictate ? "Type, or click the mic and describe the issue" : undefined} />
                <DictateButton label="Summary" onText={(text) => set({ summary: append(values.summary, text) })} />
              </div>
            </Field>
          </div>
        </div>
        {!ticket && (
          <footer>
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary">{page ? "Submit" : "Add ticket"}</button>
          </footer>
        )}
      </form>
    </div>
  );
}
