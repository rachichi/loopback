// Pending AI suggestions as ticket rows for the Review tab. An update shows in place of its ticket, with the
// proposed values; a new ticket shows on its own. Both stay greyed out until staff press Reviewed (approve)
// or Reject. No transcript text or paragraph code here, so this module is safe for the main bundle.
import type { Status, Ticket } from "../tickets/types";
import type { Suggestion } from "./types";

/** Row id of a pending suggestion, in the table and in the transcript's stand-in highlights. */
export const reviewId = (suggestion: Suggestion) => `review-${suggestion.id}`;

/** Ticket fields a suggestion can change, by their names on Ticket. */
export type ReviewField = "title" | "type" | "status" | "summary" | "location" | "requester" | "deadline";

/** What the table needs to draw a review row. */
export type ReviewRow = {
  suggestion: Suggestion;
  /** The ticket an update applies to; null for a new ticket. */
  ticketId: string | null;
  /** Fields the suggestion changes, with the ticket's value before it, for the "Was:" hints. Empty for a new ticket. */
  changed: Partial<Record<ReviewField, string>>;
};

const blank: Ticket = {
  id: "", number: "", title: "", type: "Other", status: "Open", location: { text: "", places: [] }, requester: "",
  summary: "", urgent: false, deadline: "", submittedBy: "", submittedAt: "", meetingIds: [], spans: [], ownerId: null,
  source: "transcript", closedAt: null, createdBy: null, evidence: {},
};

/** The ticket as it would be once the suggestion is approved. */
function preview(suggestion: Suggestion, base: Ticket | undefined): { ticket: Ticket; changed: ReviewRow["changed"] } {
  const c = suggestion.changes;
  const from = base ?? blank;
  const proposed: Record<ReviewField, string | undefined> = {
    title: c.title, type: c.type, status: c.status, summary: c.summary, location: c.location_text, requester: c.requester, deadline: c.deadline,
  };
  const current: Record<ReviewField, string> = {
    title: from.title, type: from.type, status: from.status, summary: from.summary, location: from.location.text, requester: from.requester, deadline: from.deadline,
  };
  const changed: ReviewRow["changed"] = {};
  if (base) for (const field of Object.keys(proposed) as ReviewField[]) if (proposed[field] !== undefined && proposed[field] !== current[field]) changed[field] = current[field];
  const ticket: Ticket = {
    ...from,
    id: reviewId(suggestion),
    title: proposed.title ?? from.title,
    type: proposed.type ?? from.type,
    status: (proposed.status ?? from.status) as Status,
    summary: proposed.summary ?? from.summary,
    location: { text: proposed.location ?? from.location.text, places: from.location.places },
    requester: proposed.requester ?? from.requester,
    deadline: proposed.deadline ?? from.deadline,
    meetingIds: [...new Set([...from.meetingIds, suggestion.meetingId])],
    spans: [...from.spans, ...suggestion.spans],
  };
  return { ticket, changed };
}

/** The table's rows with pending suggestions folded in: new tickets first, then every ticket, each one with a
 *  pending update replaced by its preview. A ticket with several pending updates shows the oldest. */
export function withReviewRows(tickets: Ticket[], suggestions: Suggestion[]): { rows: Ticket[]; review: Map<string, ReviewRow> } {
  const review = new Map<string, ReviewRow>();
  const firstUpdate = new Map<string, Suggestion>();
  for (const suggestion of suggestions) {
    if (suggestion.kind === "update" && suggestion.ticketId && !firstUpdate.has(suggestion.ticketId)) firstUpdate.set(suggestion.ticketId, suggestion);
  }
  const fresh = suggestions.filter((suggestion) => suggestion.kind === "new").map((suggestion) => {
    const { ticket } = preview(suggestion, undefined);
    review.set(ticket.id, { suggestion, ticketId: null, changed: {} });
    return ticket;
  });
  const rows = tickets.map((base) => {
    const suggestion = firstUpdate.get(base.id);
    if (!suggestion) return base;
    const { ticket, changed } = preview(suggestion, base);
    review.set(ticket.id, { suggestion, ticketId: base.id, changed });
    return ticket;
  });
  return { rows: [...fresh, ...rows], review };
}
