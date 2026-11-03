import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { formatEvidence } from "../../transcript";
import { statuses, type Ticket } from "../tickets/types";
import type { Suggestion, SuggestionChanges, SuggestionField } from "./types";

const fieldLabel: Record<SuggestionField, string> = {
  title: "Title",
  type: "Type",
  status: "Status",
  summary: "Summary",
  location_text: "Location",
  requester: "Requester",
  deadline: "Deadline",
};

/** A ticket's current value for a suggestion field. */
function currentValue(ticket: Ticket, field: SuggestionField): string {
  if (field === "location_text") return ticket.location.text;
  return ticket[field];
}

/** One pending suggestion: what it would change, the paragraphs it cites, and approve / edit / reject. */
export default function SuggestionCard({
  suggestion,
  ticket,
  ticketTypes,
  typeClass,
  active,
  canEdit,
  onHover,
  onShow,
  onApprove,
  onReject,
}: {
  suggestion: Suggestion;
  /** The ticket an update applies to; undefined for a new ticket, or if the ticket was deleted. */
  ticket: Ticket | undefined;
  ticketTypes: string[];
  typeClass: (type: string) => string;
  active: boolean;
  canEdit: boolean;
  onHover: (on: boolean) => void;
  /** Scroll the transcript to the suggestion's first paragraph. */
  onShow: () => void;
  onApprove: (edited: SuggestionChanges | null) => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SuggestionChanges>(suggestion.changes);
  const [busy, setBusy] = useState(false);
  const isNew = suggestion.kind === "new";
  const type = (isNew ? suggestion.changes.type : ticket?.type) ?? "Other";
  const fields = (Object.keys(suggestion.changes) as SuggestionField[]).filter((field) => fieldLabel[field]);

  const act = (work: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const input = (field: SuggestionField) => {
    const value = draft[field] ?? "";
    const set = (next: string) => setDraft((current) => ({ ...current, [field]: next }));
    const label = `${fieldLabel[field]} (edit)`;
    if (field === "status") return <select aria-label={label} value={value} onChange={(event) => set(event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select>;
    if (field === "type") return <select aria-label={label} value={value} onChange={(event) => set(event.target.value)}>{[...new Set([value, ...ticketTypes])].map((item) => <option key={item}>{item}</option>)}</select>;
    if (field === "deadline") return <input type="date" aria-label={label} value={value} onChange={(event) => set(event.target.value)} />;
    return <textarea aria-label={label} rows={field === "summary" ? 4 : 1} value={value} onChange={(event) => set(event.target.value)} />;
  };

  return (
    <li
      className={`suggestion-card ${typeClass(type)} ${active ? "active" : ""}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <header>
        <span className={`tag suggestion-kind ${suggestion.kind}`}>{isNew ? "New ticket" : "Update"}</span>
        <strong>{isNew ? suggestion.changes.title : ticket ? `#${ticket.number} ${ticket.title}` : "A deleted ticket"}</strong>
      </header>
      <button type="button" className="suggestion-evidence" title="Show in the transcript" onClick={onShow}>
        {formatEvidence(suggestion.evidence)}
      </button>
      {fields.length ? (
        <dl className="suggestion-fields">
          {fields.map((field) => (
            <div key={field}>
              <dt>{fieldLabel[field]}</dt>
              <dd>
                {editing ? input(field) : (
                  <>
                    {!isNew && ticket && currentValue(ticket, field) && <del>{currentValue(ticket, field)}</del>}
                    <ins>{suggestion.changes[field] || "(empty)"}</ins>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="suggestion-note">Links this meeting's discussion to the ticket. No field changes.</p>
      )}
      {suggestion.reason && <p className="suggestion-note">{suggestion.reason}</p>}
      {canEdit && (
        <div className="suggestion-actions">
          <button type="button" className="approve" disabled={busy || (!isNew && !ticket)} onClick={act(() => onApprove(editing ? draft : null))}>
            <Check size={13} /> {editing ? "Approve edits" : "Approve"}
          </button>
          {fields.length > 0 && (
            <button type="button" disabled={busy} onClick={() => { setEditing((on) => !on); setDraft(suggestion.changes); }}>
              <Pencil size={12} /> {editing ? "Cancel edit" : "Edit"}
            </button>
          )}
          <button type="button" className="reject" disabled={busy} onClick={act(onReject)}>
            <X size={13} /> Reject
          </button>
        </div>
      )}
    </li>
  );
}
