import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import LocationCell from "./LocationCell";
import DictateButton, { canDictate } from "./DictateButton";
import { statuses, type Status, type Ticket, type TicketLocation } from "./features/tickets/types";
import { useBoard } from "./lib/board";

/** The fields a person fills in. The parent sets the id and submission date; the database assigns the
 *  number and sets submitted_by to the signed-in user. */
export type IntakeFields = Omit<Ticket, "id" | "number" | "meetingIds" | "spans" | "evidence" | "ownerId" | "source" | "closedAt" | "createdBy" | "requester" | "submittedBy" | "submittedAt">;

/** Dictated text is appended, so people can speak a field in several goes or fix a typed start. */
const append = (current: string, text: string) => (current.trim() ? `${current.trimEnd()} ${text}` : text);

/** A structured intake form for a request that arrives outside a meeting (email, call, walk-in). */
export default function IntakeForm({ onSubmit, onClose }: { onSubmit: (fields: IntakeFields) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const { ticketTypes } = useBoard();
  const [type, setType] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [location, setLocation] = useState<TicketLocation>({ text: "", places: [] });
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<Status>("Open");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      title: title.trim(),
      // Type is optional on intake; an untyped request is filed as Other until someone triages it.
      type: type || "Other",
      urgent,
      deadline,
      location: { ...location, text: location.places.map((place) => place.name).join("; ") },
      summary: summary.trim(),
      status,
    });
  };

  return (
    <div className="intake-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="intake-form" role="dialog" aria-modal="true" aria-labelledby="intake-title" onSubmit={submit}>
        <header>
          <h2 id="intake-title">New request</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="intake-fields">
          <label className="wide">
            <span>Title <em>required</em></span>
            <div className="dictate-field">
              <input ref={titleRef} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Broken streetlight on Avenue B" />
              <DictateButton label="Title" onText={(text) => setTitle((current) => append(current, text))} />
            </div>
          </label>
          <label>
            <span>Type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Not sure yet</option>
              {ticketTypes.map((item) => <option key={item.label} title={item.definition}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
              {statuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="intake-check">
            <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} />
            <span>Urgent</span>
          </label>
          <label>
            <span>Deadline</span>
            <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </label>
          <div className="wide intake-map">
            <span>Map</span>
            <LocationCell location={location} label="the new request" onChange={setLocation} />
          </div>
          <label className="wide">
            <span>Summary</span>
            <div className="dictate-field">
              <textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder={canDictate ? "Type, or click the mic and describe the issue" : undefined} />
              <DictateButton label="Summary" onText={(text) => setSummary((current) => append(current, text))} />
            </div>
          </label>
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">Add ticket</button>
        </footer>
      </form>
    </div>
  );
}
