import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ClipboardList, FileText, Filter, House, Link2, LogOut, MapPin, PanelRightClose, PanelRightOpen, Plus, Search } from "lucide-react";
import loopbackLogo from "./assets/logo.png";
import { statuses, today, type EvidenceSpan, type Status, type Ticket } from "./features/tickets/types";
import TicketTable, { type ReviewRows, type TranscriptColumn } from "./TicketTable";
import MapView, { type MapFocus } from "./MapView";
import IntakeForm, { type IntakeFields } from "./IntakeForm";
import type { Session } from "@supabase/supabase-js";
import { db } from "./db";
import { deleteTicket, insertTicket, loadTickets, updateTickets } from "./features/tickets/api";
import { BoardProvider, useBoard, useBoardSwitcher, useFeature } from "./lib/board";
import SignIn from "./SignIn";
import { setAnalyticsUser, trackEvent, trackPage } from "./lib/analytics";
import ShareLink from "./ShareLink";
import PublicBoard from "./PublicBoard";
import { approveSuggestion, loadMeetings, loadSuggestions, rejectSuggestion, runMatching } from "./features/transcript/api";
import type { MeetingInfo, Suggestion } from "./features/transcript/types";
import { withReviewRows } from "./features/transcript/review";

// The transcript panel, TranscriptView and the paragraph code load only for boards with transcript_matching,
// in their own chunk (scripts/check_bundle.mjs keeps them out of the entry chunk).
const TranscriptPanel = lazy(() => import("./features/transcript/TranscriptPanel"));

/** The state of the tickets in Supabase. */
type Sync = "loading" | "saving" | "saved" | "error";
const syncLabel: Record<Sync, string> = {
  loading: "Loading…",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't reach the database",
};

function Logo() {
  const { name, logoUrl } = useBoard();
  // A logo that fails to load (bad URL, bucket not public) falls back to the board's name.
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <div className="brand-lockup" aria-label={`Loopback and ${name} branding`}>
      <div className="loopback-logo" aria-label="Loopback">
        <img src={loopbackLogo} alt="Loopback logo" className="loopback-logo-image" />
      </div>
      <span className="brand-divider" aria-hidden="true">×</span>
      <div className="board-logo">
        {logoUrl && !logoFailed
          ? <img src={logoUrl} alt={`${name} logo`} className="board-logo-image" onError={() => setLogoFailed(true)} />
          : <span className="board-logo-name">{name}</span>}
      </div>
    </div>
  );
}

type View = "home" | "tickets";

/** Who is signed in, for the account menu. The name comes from auth user metadata (supabase/scripts/set_staff_names.sql). */
type Account = { name: string; email: string; avatarUrl: string | null };

/** Up to two initials for the avatar when there is no photo. */
const initials = (name: string) => name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

function Avatar({ account, size }: { account: Account; size: number }) {
  // A photo that fails to load falls back to initials.
  const [failed, setFailed] = useState(false);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {account.avatarUrl && !failed ? <img src={account.avatarUrl} alt="" onError={() => setFailed(true)} /> : initials(account.name)}
    </span>
  );
}

/** The avatar at the right end of the nav. Clicking it opens a menu with the account and sign-out. */
function AccountMenu({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="nav-profile" ref={ref}>
      <button type="button" className="nav-profile-button" aria-label={`Account: ${account.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Avatar account={account} size={30} />
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-menu-who">
            <Avatar account={account} size={56} />
            <div>
              <strong>{account.name}</strong>
              {account.name !== account.email && <span>{account.email}</span>}
            </div>
          </div>
          <button type="button" role="menuitem" onClick={() => void db.auth.signOut()}><LogOut size={18} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

/** Right end of the nav: share link, a board switcher when the user has more than one board, and the account menu. */
function AccountControls({ account }: { account: Account }) {
  const { id, name } = useBoard();
  const { boards, switchBoard } = useBoardSwitcher();
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => setSharing(false), []);
  return (
    <div className="nav-account">
      <button type="button" className="nav-share" onClick={() => setSharing(true)}><Link2 size={15} /> Share</button>
      {sharing && <ShareLink onClose={closeShare} />}
      {boards.length > 1 && (
        // A native select is as wide as its longest option; the hidden copy of the current name sizes it to that name instead.
        <div className="board-switcher">
          <span className="board-switcher-sizer" aria-hidden="true">{name}</span>
          <select aria-label="Switch board" value={id} onChange={(event) => { trackEvent("board_switched", { board_id: event.target.value }); switchBoard(event.target.value); }}>
            {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
          </select>
          <ChevronDown className="board-switcher-chevron" size={14} aria-hidden="true" />
        </div>
      )}
      <AccountMenu account={account} />
    </div>
  );
}

function PortalHeader({ view, setView, account }: { view: View; setView: (view: View) => void; account: Account }) {
  const mapOn = useFeature("district_map");
  return (
    <>
      <header className="portal-header">
        <div className="brand-block">
          <Logo />
        </div>
      </header>
      <nav className="portal-nav">
        <button className={`nav-home ${view === "home" ? "active" : ""}`} aria-label="Home" aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}><House size={16} /></button>
        <button className={view === "tickets" ? "active" : ""} aria-current={view === "tickets" ? "page" : undefined} onClick={() => setView("tickets")}><ClipboardList size={15} /> Tickets</button>
        <AccountControls account={account} />
      </nav>
      {view === "tickets" && (
        <div className="title-band">
          <div>
            <h1>Tickets</h1>
            <span>{mapOn ? "Review and update tickets, and see where they are on the map" : "Review and update tickets"}</span>
          </div>
        </div>
      )}
    </>
  );
}

function HomeView({ onShowMap, onLookUp, onNewTicket }: {
  onShowMap: () => void;
  onLookUp: () => void;
  onNewTicket: () => void;
}) {
  const { name, backgroundUrl } = useBoard();
  const mapOn = useFeature("district_map");
  const intakeOn = useFeature("manual_intake");
  const actions = [
    ...(mapOn ? [{ label: "See Tickets on the Map", icon: MapPin, onClick: onShowMap }] : []),
    { label: "Look Up Tickets", icon: Search, onClick: onLookUp },
    ...(intakeOn ? [{ label: "Submit a New Ticket", icon: Plus, onClick: onNewTicket }] : []),
  ];
  return (
    <main className="home-view">
      <div
        className="hero-banner"
        aria-label="Home page banner"
        // The board's photo, if it has one, sits under the dark wash in index.css (.hero-banner::before).
        style={backgroundUrl ? ({ "--hero-image": `url(${JSON.stringify(backgroundUrl)})` } as CSSProperties) : undefined}
      >
        <div className="hero-content">
          <div className="hero-primary">
            <div className="hero-copy">
              <p className="hero-board">{name}</p>
              <h1>hey 👋,<br />how can we<br />help you?</h1>
            </div>
          </div>
          <div className="hero-actions">
            {actions.map(({ label, icon: Icon, onClick }) => (
              <button key={label} onClick={onClick}>
                <span>{label}</span>
                <Icon size={20} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function PortalFooter() {
  const { name } = useBoard();
  return (
    <footer className="portal-footer">
      <div className="portal-footer-inner">
        <img src={loopbackLogo} alt="Loopback" />
        <div className="portal-footer-contact">
          <p>Loopback for {name}.</p>
          <p>The Loopback portal was launched in 2026 by community members<br />to empower the community boards that serve them.</p>
          <p><strong><u>Contact us</u></strong> for questions, feedback, or feature requests.</p>
        </div>
      </div>
    </footer>
  );
}

// Review (transcript_matching) is not a third urgency: a row waiting for review is also urgent or not.
const urgencyTabs = [
  { key: "all", label: "All" },
  { key: "urgent", label: "Urgent" },
  { key: "non-urgent", label: "Non-urgent" },
  { key: "review", label: "Review" },
] as const;
type UrgencyTab = (typeof urgencyTabs)[number]["key"];
const inTab = (ticket: Ticket, tab: UrgencyTab, inReview: (id: string) => boolean) =>
  tab === "all" || (tab === "review" ? inReview(ticket.id) : ticket.urgent === (tab === "urgent"));

function UrgencyTabs({ tab, setTab, tickets, inReview, showReview }: {
  tab: UrgencyTab;
  setTab: (tab: UrgencyTab) => void;
  tickets: Ticket[];
  inReview: (id: string) => boolean;
  /** Only boards with transcript_matching have a Review tab. */
  showReview: boolean;
}) {
  return (
    <div className="urgency-tabs" role="tablist" aria-label="Filter by urgency or review">
      {urgencyTabs.filter((item) => showReview || item.key !== "review").map((item) => (
        <button key={item.key} role="tab" aria-selected={tab === item.key} className={`${item.key} ${tab === item.key ? "active" : ""}`} onClick={() => setTab(item.key)}>
          {item.label} <span>{tickets.filter((ticket) => inTab(ticket, item.key, inReview)).length}</span>
        </button>
      ))}
    </div>
  );
}

function Toolbar({
  count,
  query,
  setQuery,
  status,
  setStatus,
  onNew,
  sync,
}: {
  count: number;
  query: string;
  setQuery: (value: string) => void;
  status: "All" | Status;
  setStatus: (value: "All" | Status) => void;
  onNew: () => void;
  sync: Sync;
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
        {intakeOn && <button type="button" className="new-request" onClick={onNew}><Plus size={14} /> New ticket</button>}
      </div>
    </div>
  );
}

/** Signed out: the sign-in screen. Signed in: the portal for the user's board, once it has loaded. */
/** The token from a public share link (/share/<token>), or null on any other page. */
const shareToken = window.location.pathname.match(/^\/share\/([A-Za-z0-9_-]{20,})\/?$/)?.[1] ?? null;

export default function App() {
  // undefined until the stored session has been read, so a signed-in user never sees the sign-in screen flash.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // A public share link needs no account. The token is checked by the database (public_board).
  if (shareToken) return <PublicBoard token={shareToken} />;
  if (session === undefined) return null;
  if (!session) return <SignIn />;
  // Accounts without a full_name show their email; without an avatar_url, their initials.
  const email = session.user.email ?? "";
  const account: Account = {
    name: (session.user.user_metadata?.full_name as string | undefined) || email || "Account",
    email,
    avatarUrl: (session.user.user_metadata?.avatar_url as string | undefined) || null,
  };
  // Keyed by user so signing in as someone else starts from a clean portal, not the last user's state.
  return (
    <BoardProvider key={session.user.id} userId={session.user.id}>
      <Portal account={account} />
    </BoardProvider>
  );
}

function Portal({ account }: { account: Account }) {
  const board = useBoard();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0];
  const [sync, setSync] = useState<Sync>("loading");

  // The last version of each ticket known to be in the database; a ticket whose object differs has unsaved
  // edits, and a ticket with no entry has never been saved and needs an insert.
  const persisted = useRef(new Map<string, Ticket>());
  // New tickets whose insert is in flight. Edits made meanwhile are saved as an update once it returns.
  const inserting = useRef(new Set<string>());
  useEffect(() => {
    loadTickets(board.id)
      .then((loaded) => {
        for (const ticket of loaded) persisted.current.set(ticket.id, ticket);
        setTickets(loaded);
        setSelectedId(loaded[0]?.id ?? "");
        setSync("saved");
      })
      .catch((error) => { console.error(error); setSync("error"); });
  }, [board.id]);
  // Save shortly after typing stops: insert new tickets, update changed ones. A failed save is retried with the next edit.
  useEffect(() => {
    if (sync === "loading") return;
    const fresh = tickets.filter((ticket) => !persisted.current.has(ticket.id) && !inserting.current.has(ticket.id));
    const changed = tickets.filter((ticket) => persisted.current.has(ticket.id) && persisted.current.get(ticket.id) !== ticket);
    if (!fresh.length && !changed.length) return;
    setSync("saving");
    const timer = window.setTimeout(() => {
      for (const ticket of fresh) inserting.current.add(ticket.id);
      const inserts = fresh.map((sent) =>
        insertTicket(sent, board.id)
          .then((saved) => {
            persisted.current.set(saved.id, saved);
            trackEvent("ticket_created", { board_id: board.id, source: saved.source });
            // Keep any edits made while the insert was in flight; they differ from `saved`, so they get updated next.
            setTickets((current) => current.map((ticket) => ticket.id !== saved.id ? ticket : ticket === sent ? saved : { ...ticket, number: saved.number }));
          })
          .finally(() => inserting.current.delete(sent.id)),
      );
      Promise.all([...inserts, updateTickets(changed, board.id)])
        .then(() => {
          for (const ticket of changed) persisted.current.set(ticket.id, ticket);
          setSync("saved");
        })
        .catch((error) => { console.error(error); setSync("error"); });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [tickets, board.id, sync === "loading"]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Status>("All");
  const [hover, setHover] = useState<{ id: string | null; from: "table" | "map" }>({ id: null, from: "table" });
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [urgency, setUrgency] = useState<UrgencyTab>("all");
  // The map panel starts collapsed so the tickets get the full width.
  const mapOn = useFeature("district_map");
  const intakeOn = useFeature("manual_intake");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const transcriptOn = useFeature("transcript_matching");
  // The right panel has a Map tab (district_map) and a Transcript tab (transcript_matching).
  const panelOn = mapOn || transcriptOn;
  const [panelTab, setPanelTab] = useState<"map" | "transcript">(mapOn ? "map" : "transcript");
  const tab = !mapOn ? "transcript" : !transcriptOn ? "map" : panelTab;
  // Transcript matching: the board's meetings (no transcript text) and pending suggestions.
  const [meetings, setMeetings] = useState<MeetingInfo[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [meetingId, setMeetingId] = useState("");
  const [jump, setJump] = useState<{ id: string | null; meetingId: string | null; n: number }>({ id: null, meetingId: null, n: 0 });
  const [view, setView] = useState<View>("home");
  // Usage analytics: who by board and role only, and which screen. Fixed page names, never ticket content.
  useEffect(() => setAnalyticsUser({ board_id: board.id, role: board.role ?? "unknown" }), [board.id, board.role]);
  useEffect(() => {
    if (view === "home") trackPage("/", "Home", board.id);
    else trackPage("/tickets", "Tickets", board.id);
  }, [view, board.id]);

  // Pending suggestions become greyed-out rows: a new ticket at the top, an update in place of its ticket.
  const { rows: withReview, review } = useMemo(() => withReviewRows(tickets, transcriptOn ? suggestions : []), [tickets, suggestions, transcriptOn]);
  const inReview = useCallback((id: string) => review.has(id), [review]);
  // Search and status filters apply first, so each tab's count matches what it shows.
  const filtered = useMemo(() => withReview.filter((ticket) => {
    const matchesStatus = status === "All" || ticket.status === status;
    const search = query.toLowerCase();
    const matchesQuery = !search || `${ticket.number} ${ticket.title} ${ticket.type} ${ticket.location.text} ${ticket.location.places.map((place) => place.name).join(" ")} ${ticket.summary}`.toLowerCase().includes(search);
    return matchesStatus && matchesQuery;
  }), [withReview, query, status]);
  const rows = useMemo(() => filtered.filter((ticket) => inTab(ticket, urgency, inReview)), [filtered, urgency, inReview]);

  const updateTicket = useCallback((id: string, patch: Partial<Ticket>) => {
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, ...patch } : ticket));
  }, []);

  // New intake tickets go to the top, and the filters reset so the new row is in view.
  const addTicket = (fields: IntakeFields) => {
    // The database assigns the number when the ticket is inserted; until then it shows blank. It also sets
    // submitted_by to the signed-in user's email. Requester is no longer collected.
    // Every board shares one table, so ids must be unique across boards, not just within this one.
    const ticket: Ticket = { ...fields, requester: "", submittedBy: "", submittedAt: today(), id: crypto.randomUUID(), number: "", meetingIds: [], spans: [], evidence: {}, ownerId: null, source: "manual", closedAt: null, createdBy: null };
    setTickets((current) => [ticket, ...current]);
    setSelectedId(ticket.id);
    setQuery("");
    setStatus("All");
    setUrgency("all");
    setIntakeOpen(false);
  };
  const closeIntake = useCallback(() => setIntakeOpen(false), []);

  // Deleting asks first, waits for the database, and only then removes the row, so a failed delete leaves it in place.
  const removeTicket = async (ticket: Ticket) => {
    const label = ticket.number ? `#${ticket.number} "${ticket.title}"` : `"${ticket.title}"`;
    if (inserting.current.has(ticket.id)) {
      window.alert(`Ticket ${label} is still being saved. Try again in a moment.`);
      return;
    }
    if (!window.confirm(`Delete ticket ${label}? This can't be undone.`)) return;
    const remove = () => {
      persisted.current.delete(ticket.id);
      setTickets((current) => current.filter((item) => item.id !== ticket.id));
      if (selectedId === ticket.id) setSelectedId("");
    };
    // A ticket that was never saved only exists in this browser.
    if (!persisted.current.has(ticket.id)) { remove(); return; }
    setSync("saving");
    try {
      await deleteTicket(ticket.id);
      trackEvent("ticket_deleted", { board_id: board.id });
      remove();
      setSync("saved");
    } catch (error) {
      console.error(error);
      setSync("error");
      window.alert(`Couldn't delete ticket ${label}. ${error instanceof Error ? error.message : ""}`);
    }
  };

  useEffect(() => {
    if (!transcriptOn) return;
    Promise.all([loadMeetings(board.id), loadSuggestions(board.id)])
      .then(([loadedMeetings, loadedSuggestions]) => {
        setMeetings(loadedMeetings);
        setSuggestions(loadedSuggestions);
        setMeetingId((current) => current || loadedMeetings[0]?.id || "");
      })
      .catch((error) => console.error("Couldn't load meetings and suggestions", error));
  }, [board.id, transcriptOn]);
  const meetingLabels = useMemo(() => new Map(meetings.map((meeting) => [meeting.id, meeting.label])), [meetings]);

  const openTranscript = (nextMeetingId: string, ticketId: string | null) => {
    setPanelTab("transcript");
    setSidebarOpen(true);
    setMeetingId(nextMeetingId);
    setJump((current) => ({ id: ticketId, meetingId: nextMeetingId, n: current.n + 1 }));
    trackEvent("transcript_opened", { board_id: board.id });
  };
  const transcriptColumn: TranscriptColumn | undefined = transcriptOn ? {
    meetingLabel: (id) => meetingLabels.get(id),
    onShow: (rowId, id) => { setSelectedId(rowId); openTranscript(id, rowId); },
  } : undefined;

  // After a run, the table switches to the Review tab, where the new suggestions are waiting.
  const matchMeeting = async (id: string) => {
    const result = await runMatching(id);
    trackEvent("matching_run", { board_id: board.id, updates: result.updates, new: result.new });
    const [loadedMeetings, loadedSuggestions] = await Promise.all([loadMeetings(board.id), loadSuggestions(board.id)]);
    setMeetings(loadedMeetings);
    setSuggestions(loadedSuggestions);
    setUrgency("review");
  };
  // Reviewed approves the suggestion as shown; Reject dismisses it. Either way one suggestion_reviewed event
  // is sent, with the kind, the outcome and how many fields the suggestion changed. Never its content.
  const reviewed = (outcome: "accepted" | "rejected", suggestion: Suggestion) =>
    trackEvent("suggestion_reviewed", { board_id: board.id, kind: suggestion.kind, outcome, fields_changed: Object.keys(suggestion.changes).length });
  const reviewRows: ReviewRows | undefined = transcriptOn ? {
    rows: review,
    onReviewed: async (rowId) => {
      const info = review.get(rowId);
      if (!info) return;
      const { suggestion } = info;
      // The database merges the suggestion into the ticket as stored, so unsaved edits in this browser would be lost.
      const local = info.ticketId ? tickets.find((ticket) => ticket.id === info.ticketId) : undefined;
      if (local && persisted.current.get(local.id) !== local) {
        window.alert(`Ticket #${local.number} has edits that are still saving. Try again in a moment.`);
        return;
      }
      try {
        const saved = await approveSuggestion(suggestion.id, null);
        persisted.current.set(saved.id, saved);
        setTickets((current) => current.some((ticket) => ticket.id === saved.id)
          ? current.map((ticket) => ticket.id === saved.id ? saved : ticket)
          : [saved, ...current]);
        setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
        if (selectedId === rowId) setSelectedId(saved.id);
        reviewed("accepted", suggestion);
      } catch (error) {
        console.error(error);
        window.alert(`Couldn't apply the suggestion. ${error instanceof Error ? error.message : ""}`);
      }
    },
    onReject: async (rowId) => {
      const info = review.get(rowId);
      if (!info) return;
      try {
        await rejectSuggestion(info.suggestion.id);
        setSuggestions((current) => current.filter((item) => item.id !== info.suggestion.id));
        reviewed("rejected", info.suggestion);
      } catch (error) {
        console.error(error);
        window.alert(`Couldn't reject the suggestion. ${error instanceof Error ? error.message : ""}`);
      }
    },
  } : undefined;
  // Dragging a highlight's end in the transcript edits that ticket's span; it saves like any other edit.
  const updateSpan = useCallback((ticketId: string, index: number, span: EvidenceSpan) => {
    setTickets((current) => current.map((ticket) => ticket.id === ticketId ? { ...ticket, spans: ticket.spans.map((item, i) => i === index ? span : item) } : ticket));
  }, []);
  const onTranscriptHover = useCallback((id: string | null) => setHover({ id, from: "map" }), []);

  // With the transcript open, selecting a ticket scrolls to its highlights: in the shown meeting if it was
  // discussed there, otherwise in the newest meeting it was discussed in.
  // A review row scrolls to its suggestion's meeting.
  const selectTicket = (ticket: Ticket) => {
    setSelectedId(ticket.id);
    if (!transcriptOn || !sidebarOpen || tab !== "transcript" || !ticket.meetingIds.length) return;
    const suggestedFrom = review.get(ticket.id)?.suggestion.meetingId;
    const target = suggestedFrom ?? (ticket.meetingIds.includes(meetingId) ? meetingId : ticket.meetingIds[ticket.meetingIds.length - 1]);
    if (!meetingLabels.has(target)) return;
    setMeetingId(target);
    setJump((current) => ({ id: ticket.id, meetingId: target, n: current.n + 1 }));
  };

  const onMapHover = useCallback((id: string | null) => setHover({ id, from: "map" }), []);
  // The table's Map cell opens the map on the ticket's first place; a place chip opens it on that place.
  const showOnMap = (id: string, place: number) => {
    setSelectedId(id);
    setSidebarOpen(true);
    setPanelTab("map");
    setMapFocus((current) => ({ ticketId: id, place, n: (current?.n ?? 0) + 1 }));
  };

  if (view === "home") {
    return (
      <div className="portal">
        <PortalHeader view={view} setView={setView} account={account} />
        <HomeView
          onShowMap={() => { setSidebarOpen(true); setView("tickets"); }}
          onLookUp={() => setView("tickets")}
          onNewTicket={() => { setView("tickets"); setIntakeOpen(true); }}
        />
        <PortalFooter />
      </div>
    );
  }

  // Block the screen only while loading or when loading failed; a board with no tickets yet gets the normal, empty table.
  if (sync === "loading" || (sync === "error" && !tickets.length)) {
    return (
      <div className="portal">
        <PortalHeader view={view} setView={setView} account={account} />
        <main className="workspace-message">
          {sync === "loading" && "Loading tickets…"}
          {sync === "error" && "Couldn't load tickets. Check your connection and reload the page."}
        </main>
        <PortalFooter />
      </div>
    );
  }

  return (
    <div className="portal">
      <PortalHeader view={view} setView={setView} account={account} />
      <main className={`workspace ${!panelOn ? "no-map" : sidebarOpen ? "" : "sidebar-collapsed"}`}>
        <section className="records-pane">
          <UrgencyTabs tab={urgency} setTab={setUrgency} tickets={filtered} inReview={inReview} showReview={transcriptOn} />
          <Toolbar count={rows.length} query={query} setQuery={setQuery} status={status} setStatus={setStatus} onNew={() => setIntakeOpen(true)} sync={sync} />
          <TicketTable rows={rows} selectedId={review.has(selectedId) ? selectedId : selected?.id ?? ""} emptyMessage={urgency === "review" ? "Nothing to review. Open a meeting in the Transcript tab and press Generate." : tickets.length ? undefined : intakeOn ? "No tickets yet. Add the first one with New ticket." : "No tickets yet."} hoveredId={hover.id} followHover={hover.from !== "table"} onHover={(id) => setHover({ id, from: "table" })} onSelect={selectTicket} onChange={updateTicket} onShowOnMap={mapOn ? showOnMap : undefined} onDelete={removeTicket} transcript={transcriptColumn} review={reviewRows} />
        </section>
        {/* district_map and transcript_matching both off: no panel, no rail, and the Map cells don't open one. */}
        {!panelOn ? null : sidebarOpen ? (
          <aside className="insights-pane">
            <div className="insights-tabs" role="tablist">
              {mapOn && <button type="button" role="tab" aria-selected={tab === "map"} className={tab === "map" ? "active" : ""} onClick={() => setPanelTab("map")}><MapPin size={15} /> Map</button>}
              {transcriptOn && <button type="button" role="tab" aria-selected={tab === "transcript"} className={tab === "transcript" ? "active" : ""} onClick={() => setPanelTab("transcript")}><FileText size={15} /> Transcript{suggestions.length > 0 && <span className="tab-count">{suggestions.length}</span>}</button>}
              <button type="button" className="sidebar-toggle" aria-label="Collapse panel" title="Collapse panel" onClick={() => setSidebarOpen(false)}><PanelRightClose size={16} /></button>
            </div>
            {tab === "map" && <MapView tickets={tickets} selected={selected} hoveredId={hover.id} focus={mapFocus} onHover={onMapHover} onSelect={selectTicket} />}
            {tab === "transcript" && (
              <Suspense fallback={<div className="transcript-empty">Loading transcript…</div>}>
                <TranscriptPanel
                  meetings={meetings}
                  meetingId={meetingId}
                  onMeetingChange={setMeetingId}
                  tickets={tickets}
                  suggestions={suggestions}
                  hoveredId={hover.id}
                  onHover={onTranscriptHover}
                  onSpanChange={updateSpan}
                  jump={jump}
                  canEdit={board.role !== null}
                  onRunMatching={matchMeeting}
                />
              </Suspense>
            )}
          </aside>
        ) : (
          // Collapsed: a slim rail that reopens the panel, optionally straight to one tab.
          <aside className="insights-rail" aria-label="Panel (collapsed)">
            <button type="button" aria-label="Expand panel" title="Expand panel" onClick={() => setSidebarOpen(true)}><PanelRightOpen size={16} /></button>
            {mapOn && <button type="button" aria-label="Open map" title="Map" onClick={() => { setPanelTab("map"); setSidebarOpen(true); }}><MapPin size={16} /></button>}
            {transcriptOn && <button type="button" aria-label="Open transcript" title="Transcript" onClick={() => { setPanelTab("transcript"); setSidebarOpen(true); }}><FileText size={16} /></button>}
          </aside>
        )}
      </main>
      {intakeOpen && intakeOn && <IntakeForm onSubmit={addTicket} onClose={closeIntake} />}
      <PortalFooter />
    </div>
  );
}
