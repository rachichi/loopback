// The Tickets tab's urgency tabs and toolbar, shared with the Meetings tab's ticket section.
import type { ReactNode } from "react";
import { Filter, Plus, Search } from "lucide-react";
import RowHeightMenu from "./RowHeightMenu";
import type { RowHeight } from "./TicketTable";
import { statuses, type Status, type Ticket } from "./features/tickets/types";
import { useFeature } from "./lib/board";

/** The state of the tickets in Supabase. */
export type Sync = "loading" | "saving" | "saved" | "error";
export const syncLabel: Record<Sync, string> = {
  loading: "Loading…",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't reach the database",
};

// Review (transcript_matching) is not a third urgency: a row waiting for review is also urgent or not.
export const urgencyTabs = [
  { key: "all", label: "All" },
  { key: "urgent", label: "Urgent" },
  { key: "non-urgent", label: "Non-urgent" },
  { key: "review", label: "Review" },
] as const;
export type UrgencyTab = (typeof urgencyTabs)[number]["key"];
export const inTab = (ticket: Ticket, tab: UrgencyTab, inReview: (id: string) => boolean) =>
  tab === "all" || (tab === "review" ? inReview(ticket.id) : ticket.urgent === (tab === "urgent"));

export function UrgencyTabs({ tab, setTab, tickets, inReview, showReview, hideNonUrgent, children }: {
  tab: UrgencyTab;
  setTab: (tab: UrgencyTab) => void;
  tickets: Ticket[];
  inReview: (id: string) => boolean;
  /** Only boards with transcript_matching have a Review tab. */
  showReview: boolean;
  /** Phones leave out the Non-urgent tab. */
  hideNonUrgent?: boolean;
  /** Extra controls at the right end of the tab row. */
  children?: ReactNode;
}) {
  return (
    <div className="urgency-tabs" role="tablist" aria-label="Filter by urgency or review">
      {urgencyTabs.filter((item) => (showReview || item.key !== "review") && !(hideNonUrgent && item.key === "non-urgent")).map((item) => (
        <button key={item.key} role="tab" aria-selected={tab === item.key} className={`${item.key} ${tab === item.key ? "active" : ""}`} onClick={() => setTab(item.key)}>
          {item.label} <span>{tickets.filter((ticket) => inTab(ticket, item.key, inReview)).length}</span>
        </button>
      ))}
      {children}
    </div>
  );
}

export function Toolbar({
  count,
  query,
  setQuery,
  status,
  setStatus,
  onNew,
  sync,
  rowHeight,
  setRowHeight,
}: {
  count: number;
  query: string;
  setQuery: (value: string) => void;
  status: "All" | Status;
  setStatus: (value: "All" | Status) => void;
  onNew: () => void;
  sync: Sync;
  rowHeight: RowHeight;
  setRowHeight: (value: RowHeight) => void;
}) {
  const intakeOn = useFeature("manual_intake");
  return (
    <div className="table-toolbar">
      <div className="table-meta">
        <strong className="table-count">{count} tickets</strong>
        <span className={`sync-state ${sync}`} role="status">{syncLabel[sync]}</span>
      </div>
      <div className="toolbar-actions">
        <label className="table-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a ticket" /></label>
        <div className="filter-wrap">
          <Filter size={14} />
          <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as "All" | Status)}>
            <option>All</option>{statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <RowHeightMenu value={rowHeight} onChange={setRowHeight} />
        {intakeOn && <button type="button" className="new-request" onClick={onNew}><Plus size={14} /> New ticket</button>}
      </div>
    </div>
  );
}
