import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Paperclip, User, X } from "lucide-react";
import LocationCell from "./LocationCell";
import DictateButton, { canDictate } from "./DictateButton";
import { fieldIcons, type EditableField } from "./TicketTable";
import TicketAttachments from "./features/tickets/TicketAttachments";
import { statuses, type Status, type Ticket } from "./features/tickets/types";
import { agencies, agencyLabel } from "./features/tickets/agencies";
import { useBoard } from "./lib/board";
import { ATTACHMENT_ACCEPT, ATTACHMENT_KINDS, attachmentProblem, MAX_ATTACHMENT_BYTES } from "./features/tickets/attachments";

/** The fields a person fills in. The parent sets the id and submission date; the database assigns the
 *  number and sets submitted_by to the signed-in user. */
export type IntakeFields = Omit<Ticket, "id" | "number" | "meetingIds" | "spans" | "evidence" | "ownerId" | "source" | "closedAt" | "createdBy" | "requester" | "submittedBy" | "submittedAt">;

/** Dictated text is appended, so people can speak a field in several goes or fix a typed start. */
const append = (current: string, text: string) => (current.trim() ? `${current.trimEnd()} ${text}` : text);

const blank: IntakeFields = { title: "", type: "", urgent: false, deadline: "", location: { text: "", places: [] }, agency: "", serviceRequestNumber: "", dateOpened: "", summary: "", contactName: "", contactPhone: "", contactEmail: "", actionsTaken: "", status: "Open" };

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

/** Read-only details of the chosen agency, from the bundled list: who heads it and where its contact page is. */
function AgencyInfo({ name }: { name: string }) {
  const agency = agencies.find((item) => item.name === name);
  if (!agency || (!agency.head && !agency.contactUrl)) return null;
  return (
    <div className="agency-info" aria-label="Agency contact">
      {agency.head && <span>{agency.head}</span>}
      {agency.contactUrl && <a href={agency.contactUrl} target="_blank" rel="noopener noreferrer">Contact page</a>}
    </div>
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
  /** New ticket only. The files are to attach once the ticket has saved. */
  onSubmit?: (fields: IntakeFields, files: File[]) => void;
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
  const { ticketTypes, role } = useBoard();
  // Files picked on a new ticket wait here; the portal uploads them once the ticket has saved.
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const problem = picked.map(attachmentProblem).find(Boolean) ?? null;
    setFileError(problem);
    if (!problem) setFiles((current) => [...current, ...picked]);
  };
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
      actionsTaken: draft.actionsTaken.trim(),
      contactName: draft.contactName.trim(),
      contactPhone: draft.contactPhone.trim(),
      contactEmail: draft.contactEmail.trim(),
      serviceRequestNumber: draft.serviceRequestNumber.trim(),
    }, files);
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
            <div className="form-field" role="group" aria-label="Contact">
              <span className="form-field-name"><User size={14} aria-hidden="true" /> Contact</span>
              <div className="form-field-value intake-contact">
                <input type="text" aria-label="Name" placeholder="Name" autoComplete="name" value={values.contactName} onChange={(event) => set({ contactName: event.target.value })} />
                <input type="tel" aria-label="Phone" placeholder="Phone" autoComplete="tel" value={values.contactPhone} onChange={(event) => set({ contactPhone: event.target.value })} />
                <input type="email" aria-label="Email" placeholder="Email" autoComplete="email" value={values.contactEmail} onChange={(event) => set({ contactEmail: event.target.value })} />
              </div>
            </div>
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
            <Field field="agency" label="Agency">
              <select value={values.agency} onChange={(event) => set({ agency: event.target.value })}>
                <option value="">Not sent to an agency</option>
                {agencies.map((agency) => <option key={agency.name} value={agency.name}>{agencyLabel(agency)}</option>)}
                {/* Keep an agency the list doesn't have selectable, so the select doesn't misreport it. */}
                {values.agency && !agencies.some((agency) => agency.name === values.agency) && <option>{values.agency}</option>}
              </select>
              <AgencyInfo name={values.agency} />
            </Field>
            <Field field="serviceRequestNumber" label="Service Request or Work Order #">
              <input type="text" className="intake-text" value={values.serviceRequestNumber} onChange={(event) => set({ serviceRequestNumber: event.target.value })} placeholder="e.g. 311-12345678" />
            </Field>
            <Field field="dateOpened" label="Date Opened">
              <input type="date" className="intake-date" value={values.dateOpened} onChange={(event) => set({ dateOpened: event.target.value })} />
            </Field>
            <Field field="location" label="Map" asLabel={false}>
              <div className="intake-map">
                <LocationCell warningText location={values.location} label={ticket ? ticket.title || "the ticket" : "the new ticket"} onChange={(location) => set({ location })} />
                {!values.location.text.trim() && !values.location.crossStreets && !values.location.places.length && <p className="intake-map-hint">Add an address or cross streets so this ticket shows on the map.</p>}
              </div>
            </Field>
            <Field field="summary" label="Ticket details">
              <div className="dictate-field">
                <textarea rows={3} value={values.summary} onChange={(event) => set({ summary: event.target.value })} placeholder={canDictate ? "Type, or click the mic and describe the issue" : undefined} />
                <DictateButton label="Ticket details" onText={(text) => set({ summary: append(values.summary, text) })} />
              </div>
            </Field>
            <Field field="actionsTaken" label="Actions taken">
              <div className="dictate-field">
                <textarea rows={3} value={values.actionsTaken} onChange={(event) => set({ actionsTaken: event.target.value })} placeholder={canDictate ? "Type, or click the mic and describe what has been done" : undefined} />
                <DictateButton label="Actions taken" onText={(text) => set({ actionsTaken: append(values.actionsTaken, text) })} />
              </div>
            </Field>
            {!ticket && role !== null && (
              <div className="form-field">
                <span className="form-field-name"><Paperclip size={14} aria-hidden="true" /> Attachments</span>
                <div className="form-field-value">
                  <div className="attachments">
                    {files.map((file, index) => (
                      <div className="attachment" key={`${file.name}-${index}`}>
                        <span className="attachment-open"><span className="attachment-name">{file.name}</span></span>
                        <button type="button" className="attachment-remove" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, at) => at !== index))}><X size={12} /></button>
                      </div>
                    ))}
                    <button type="button" className="place-add attachment-add" onClick={() => fileRef.current?.click()}>
                      <Paperclip size={11} aria-hidden="true" /> Attach a file
                    </button>
                    <input ref={fileRef} type="file" accept={ATTACHMENT_ACCEPT} multiple hidden onChange={(event) => { pickFiles(event.target.files); event.target.value = ""; }} />
                    <span className="attachments-muted">{ATTACHMENT_KINDS}, up to {MAX_ATTACHMENT_BYTES / 1024 / 1024} MB each. Only staff of this board can see attachments.</span>
                    {fileError && <p className="attachments-error" role="alert">{fileError}</p>}
                  </div>
                </div>
              </div>
            )}
            {ticket && (
              <div className="form-field">
                <span className="form-field-name"><Paperclip size={14} aria-hidden="true" /> Attachments</span>
                <div className="form-field-value"><TicketAttachments ticketId={ticket.id} saved={Boolean(ticket.number)} /></div>
              </div>
            )}
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
