import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CalendarDays, ChevronDown, ClipboardList, FileText, House, Link2, LogOut, MapPin, PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
import loopbackLogo from "./assets/logo.png";
import { today, type EvidenceSpan, type Status, type Ticket } from "./features/tickets/types";
import TicketTable, { loadRowHeight, saveRowHeight, type ReviewRows, type TranscriptColumn } from "./TicketTable";
import { inTab, Toolbar, UrgencyTabs, type Sync, type UrgencyTab } from "./TicketFilters";
import MapView, { type MapFocus } from "./MapView";
import IntakeForm, { type IntakeFields } from "./IntakeForm";
import Logo from "./Logo";
import SubmitFlow from "./SubmitFlow";
import type { Session } from "@supabase/supabase-js";
import { db } from "./db";
import { deleteTickets, insertTicket, loadTickets, updateTickets } from "./features/tickets/api";
import { BoardProvider, takeBoardLanding, useBoard, useBoardSwitcher, useFeature } from "./lib/board";
import SignIn from "./SignIn";
import { setAnalyticsUser, trackEvent, trackPage } from "./lib/analytics";
import { useDismiss } from "./lib/useDismiss";
import { useMediaQuery } from "./lib/useMediaQuery";
import ShareLink from "./ShareLink";
import PublicBoard from "./PublicBoard";
import { addMeeting, approveSuggestion, loadMeetings, loadSuggestions, rejectSuggestion, runMatching, runMinutes, setPinnedFolders } from "./features/transcript/api";
import type { MeetingInfo, Suggestion } from "./features/transcript/types";
import { withReviewRows } from "./features/transcript/review";

// The transcript panel, TranscriptView and the paragraph code load only for boards with transcript_matching,
// in their own chunk (scripts/check_bundle.mjs keeps them out of the entry chunk).
const TranscriptPanel = lazy(() => import("./features/transcript/TranscriptPanel"));
// The Meetings tab (meetings_tab) loads the same way, in its own chunk.
const MeetingsPage = lazy(() => import("./features/meetings/MeetingsPage"));
// The public landing page (/landing): fake demo data only, in its own chunk.
const Landing = lazy(() => import("./features/landing/Landing"));

type View = "home" | "tickets" | "meetings" | "submit";

/** The full-screen submit flow opens straight from a ?submit link. */
const submitLink = new URLSearchParams(window.location.search).has("submit");

/** Phones get Home, the ticket table and the full-screen intake form; the table, map, transcript and meetings need a wider screen. */
const MOBILE_QUERY = "(max-width: 850px)";

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
function AccountMenu({ account, children }: { account: Account; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
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
          {children}
          <button type="button" role="menuitem" onClick={() => void db.auth.signOut()}><LogOut size={18} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

/** Right end of the nav: share link, a board switcher when the user has more than one board, and the account menu. */
function AccountControls({ account, mobile }: { account: Account; mobile: boolean }) {
  const { id, name } = useBoard();
  const { boards, switchBoard } = useBoardSwitcher();
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => setSharing(false), []);
  const switcher = boards.length > 1 && (
    // A native select is as wide as its longest option; the hidden copy of the current name sizes it to that name instead.
    <div className="board-switcher">
      <span className="board-switcher-sizer" aria-hidden="true">{name}</span>
      <select aria-label="Switch board" value={id} onChange={(event) => { trackEvent("board_switched", { board_id: event.target.value }); switchBoard(event.target.value); }}>
        {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
      </select>
      <ChevronDown className="board-switcher-chevron" size={14} aria-hidden="true" />
    </div>
  );
  // Phones show only the profile circle; Share and the board switcher move into its menu.
  if (mobile) {
    return (
      <div className="nav-account">
        <AccountMenu account={account}>
          <button type="button" role="menuitem" onClick={() => setSharing(true)}><Link2 size={18} /> Share read-only link</button>
          {boards.length > 1 && <div className="account-menu-boards">{switcher}</div>}
        </AccountMenu>
        {sharing && <ShareLink onClose={closeShare} />}
      </div>
    );
  }
  return (
    <div className="nav-account">
      <button type="button" className="nav-share" onClick={() => setSharing(true)}><Link2 size={15} /> Share</button>
      {sharing && <ShareLink onClose={closeShare} />}
      {switcher}
      <AccountMenu account={account} />
    </div>
  );
}

function PortalHeader({ view, setView, account, mobile }: { view: View; setView: (view: View) => void; account: Account; mobile: boolean }) {
  const mapOn = useFeature("district_map");
  const meetingsOn = useFeature("meetings_tab");
  return (
    <>
      <header className="portal-header">
        <div className="brand-block">
          <Logo />
        </div>
      </header>
      <nav className={`portal-nav ${meetingsOn ? "has-meetings" : ""} ${mobile ? "mobile" : ""}`}>
        <button className={`nav-home ${view === "home" ? "active" : ""}`} aria-label="Home" aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}><House size={16} /></button>
        <button className={view === "tickets" ? "active" : ""} aria-current={view === "tickets" ? "page" : undefined} onClick={() => setView("tickets")}><ClipboardList size={15} /> Tickets</button>
        {meetingsOn && <button className={`nav-meetings ${view === "meetings" ? "active" : ""}`} aria-current={view === "meetings" ? "page" : undefined} onClick={() => setView("meetings")}><CalendarDays size={15} /> Meetings</button>}
        <AccountControls account={account} mobile={mobile} />
      </nav>
      {view === "tickets" && !mobile && (
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

function HomeView({ mobile, onShowMap, onMinutes, onNewTicket }: {
  mobile: boolean;
  onShowMap: () => void;
  onMinutes: () => void;
  onNewTicket: () => void;
}) {
  const { name, backgroundUrl } = useBoard();
  const mapOn = useFeature("district_map");
  const intakeOn = useFeature("manual_intake");
  const meetingsOn = useFeature("meetings_tab");
  const actions = mobile ? [
    ...(intakeOn ? [{ label: "Submit a New Ticket", icon: Plus, onClick: onNewTicket }] : []),
  ] : [
    ...(meetingsOn ? [{ label: "Generate Meeting Minutes", icon: FileText, onClick: onMinutes }] : []),
    ...(intakeOn ? [{ label: "Create a new ticket", icon: Plus, onClick: onNewTicket }] : []),
    ...(mapOn ? [{ label: "See tickets on a Map", icon: MapPin, onClick: onShowMap }] : []),
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

/** Signed out: the sign-in screen. Signed in: the portal for the user's board, once it has loaded. */
/** The token from a public share link (/share/<token>), or null on any other page. */
const shareToken = window.location.pathname.match(/^\/share\/([A-Za-z0-9_-]{20,})\/?$/)?.[1] ?? null;

/** True on the landing page. Part 1 serves it at /landing; a landing hostname comes with the rollout. */
const landing = /^\/landing\/?$/.test(window.location.pathname);

export default function App() {
  // undefined until the stored session has been read, so a signed-in user never sees the sign-in screen flash.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // The landing page needs no account and never touches the database.
  if (landing) return <Suspense fallback={null}><Landing /></Suspense>;
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
  // When the intake form opened, and when each new ticket was submitted, for the ticket_created timings.
  const intakeOpenedAt = useRef(0);
  const submittedAt = useRef(new Map<string, { at: number; formMs: number }>());
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
            const timing = submittedAt.current.get(sent.id);
            submittedAt.current.delete(sent.id);
            trackEvent("ticket_created", {
              board_id: board.id,
              source: saved.source,
              // form_ms: form open to submit. save_ms: submit to saved in the database.
              ...(timing ? { form_ms: timing.formMs, save_ms: Date.now() - timing.at } : {}),
            });
            // Keep any edits made while the insert was in flight; they differ from `saved`, so they get updated next.
            setTickets((current) => current.map((ticket) => ticket.id !== saved.id ? ticket : ticket === sent ? saved : { ...ticket, number: saved.number }));
          })
          .catch((error) => { submittedAt.current.delete(sent.id); throw error; })
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
  useEffect(() => { if (intakeOpen) intakeOpenedAt.current = Date.now(); }, [intakeOpen]);
  const markIntakeStart = useCallback(() => { intakeOpenedAt.current = Date.now(); }, []);
  const transcriptOn = useFeature("transcript_matching");
  const meetingsOn = useFeature("meetings_tab");
  // Meetings and suggestions load, and review rows exist, for either flag.
  const matchingOn = transcriptOn || meetingsOn;
  // The meeting open in the Meetings tab: "list" for the table, null until first opened (then the newest meeting).
  const [meetingView, setMeetingView] = useState<string | null>(null);
  // The right panel has a Map tab (district_map) and a Transcript tab (transcript_matching).
  const panelOn = mapOn || transcriptOn;
  const [panelTab, setPanelTab] = useState<"map" | "transcript">(mapOn ? "map" : "transcript");
  const tab = !mapOn ? "transcript" : !transcriptOn ? "map" : panelTab;
  // Transcript matching: the board's meetings (no transcript text) and pending suggestions.
  const [meetings, setMeetings] = useState<MeetingInfo[]>([]);
  const [pinnedFolders, setPinned] = useState<string[]>(board.pinnedMeetingFolders);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [meetingId, setMeetingId] = useState("");
  const [jump, setJump] = useState<{ id: string | null; meetingId: string | null; n: number }>({ id: null, meetingId: null, n: 0 });
  const mobile = useMediaQuery(MOBILE_QUERY);
  // After picking a board in the switcher, land on its tickets (phones only have Home and the intake form).
  // Phones have no Non-urgent tab, so a window resized from desktop can't be left on it.
  useEffect(() => { if (mobile && urgency === "non-urgent") setUrgency("all"); }, [mobile, urgency]);
  const [view, setView] = useState<View>(() => (submitLink ? "submit" : takeBoardLanding() && !window.matchMedia(MOBILE_QUERY).matches ? "tickets" : "home"));
  // The ticket open in the expanded form, if any.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const closeExpanded = useCallback(() => setExpandedId(null), []);
  const [rowHeight, setRowHeight] = useState(loadRowHeight);
  useEffect(() => saveRowHeight(rowHeight), [rowHeight]);
  // Usage analytics: who by board and role only, and which screen. Fixed page names, never ticket content.
  useEffect(() => setAnalyticsUser({ board_id: board.id, role: board.role ?? "unknown" }), [board.id, board.role]);
  useEffect(() => {
    if (view === "home") trackPage("/", "Home", board.id);
    else if (view === "meetings") trackPage("/meetings", "Meetings", board.id);
    else if (view === "submit") trackPage("/submit", "Submit", board.id);
    else trackPage("/tickets", "Tickets", board.id);
  }, [view, board.id]);

  // Pending suggestions become greyed-out rows: a new ticket at the top, an update in place of its ticket.
  const { rows: withReview, review } = useMemo(() => withReviewRows(tickets, matchingOn ? suggestions : []), [tickets, suggestions, matchingOn]);
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
    const now = Date.now();
    submittedAt.current.set(ticket.id, { at: now, formMs: intakeOpenedAt.current ? now - intakeOpenedAt.current : 0 });
    setTickets((current) => [ticket, ...current]);
    setSelectedId(ticket.id);
    setQuery("");
    setStatus("All");
    setUrgency("all");
    setIntakeOpen(false);
  };
  const closeIntake = useCallback(() => setIntakeOpen(false), []);
  // Cmd+N (Ctrl+N elsewhere) opens New ticket. Some browsers keep it for a new window; there it needs Ctrl+Alt+N as well.
  useEffect(() => {
    if (!intakeOn || mobile) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n" || !(event.metaKey || event.ctrlKey) || event.shiftKey) return;
      event.preventDefault();
      setView("tickets");
      setIntakeOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [intakeOn, mobile]);

  // Deleting asks first, waits for the database, and only then removes the rows, so a failed delete leaves them in place.
  const removeTickets = async (list: Ticket[]) => {
    if (!list.length) return;
    const label = (ticket: Ticket) => ticket.number ? `#${ticket.number} "${ticket.title}"` : `"${ticket.title}"`;
    if (list.some((ticket) => inserting.current.has(ticket.id))) {
      window.alert(list.length > 1 ? "Some of these tickets are still being saved. Try again in a moment." : `Ticket ${label(list[0])} is still being saved. Try again in a moment.`);
      return;
    }
    const question = list.length > 1 ? `Delete ${list.length} tickets? This can't be undone.` : `Delete ticket ${label(list[0])}? This can't be undone.`;
    if (!window.confirm(question)) return;
    const remove = (ids: Set<string>) => {
      for (const id of ids) persisted.current.delete(id);
      setTickets((current) => current.filter((item) => !ids.has(item.id)));
      if (ids.has(selectedId)) setSelectedId("");
      if (expandedId && ids.has(expandedId)) setExpandedId(null);
    };
    // A ticket that was never saved only exists in this browser.
    const saved = list.filter((ticket) => persisted.current.has(ticket.id));
    const local = new Set(list.filter((ticket) => !persisted.current.has(ticket.id)).map((ticket) => ticket.id));
    if (!saved.length) { remove(local); return; }
    setSync("saving");
    try {
      const deleted = await deleteTickets(saved.map((ticket) => ticket.id));
      deleted.forEach(() => trackEvent("ticket_deleted", { board_id: board.id }));
      remove(new Set([...local, ...deleted]));
      setSync("saved");
      // RLS hides rows the user may not delete, which shows up as fewer rows deleted rather than an error.
      const missed = saved.length - deleted.length;
      if (missed) window.alert(`${missed} of ${saved.length} tickets couldn't be deleted (missing, or you can't delete on this board).`);
    } catch (error) {
      console.error(error);
      setSync("error");
      window.alert(`Couldn't delete ${list.length > 1 ? `${list.length} tickets` : `ticket ${label(list[0])}`}. ${error instanceof Error ? error.message : ""}`);
    }
  };

  useEffect(() => {
    if (!matchingOn) return;
    Promise.all([loadMeetings(board.id), loadSuggestions(board.id)])
      .then(([loadedMeetings, loadedSuggestions]) => {
        setMeetings(loadedMeetings);
        setSuggestions(loadedSuggestions);
        setMeetingId((current) => current || loadedMeetings[0]?.id || "");
      })
      .catch((error) => console.error("Couldn't load meetings and suggestions", error));
  }, [board.id, matchingOn]);
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
  // Runs started per meeting in this tab, so repeat clicks show up without sending a meeting id.
  const matchRuns = useRef(new Map<string, number>());
  const matchMeeting = async (id: string) => {
    const run = (matchRuns.current.get(id) ?? 0) + 1;
    matchRuns.current.set(id, run);
    const startedAt = Date.now();
    trackEvent("matching_started", { board_id: board.id, run_in_session: run, already_generated: Boolean(meetings.find((meeting) => meeting.id === id)?.matchedAt) });
    let result: Awaited<ReturnType<typeof runMatching>>;
    try {
      result = await runMatching(id);
    } catch (error) {
      trackEvent("matching_failed", { board_id: board.id, run_in_session: run, duration_ms: Date.now() - startedAt });
      throw error;
    }
    trackEvent("matching_run", { board_id: board.id, updates: result.updates, new: result.new, run_in_session: run, duration_ms: Date.now() - startedAt });
    const [loadedMeetings, loadedSuggestions] = await Promise.all([loadMeetings(board.id), loadSuggestions(board.id)]);
    setMeetings(loadedMeetings);
    setSuggestions(loadedSuggestions);
    setUrgency("review");
  };
  // The Meetings tab's button: drafts whichever of tickets and minutes the meeting doesn't have yet, in parallel.
  const generateMeeting = async (id: string) => {
    const meeting = meetings.find((item) => item.id === id);
    if (!meeting) return;
    const startedAt = Date.now();
    trackEvent("meeting_generate_started", { board_id: board.id });
    const jobs: Promise<unknown>[] = [];
    if (!meeting.matchedAt) jobs.push(runMatching(id));
    if (!meeting.minutesAt) jobs.push(runMinutes(id));
    const results = await Promise.allSettled(jobs);
    // Reload either way: one half may have finished even if the other failed.
    const [loadedMeetings, loadedSuggestions] = await Promise.all([loadMeetings(board.id), loadSuggestions(board.id)]);
    setMeetings(loadedMeetings);
    setSuggestions(loadedSuggestions);
    const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed) {
      trackEvent("meeting_generate_failed", { board_id: board.id, duration_ms: Date.now() - startedAt });
      throw failed.reason;
    }
    trackEvent("meeting_generate_done", { board_id: board.id, duration_ms: Date.now() - startedAt });
  };
  // The Meetings tab's Upload transcript form: files the transcript as a meeting, then reloads the list.
  const uploadMeeting = async ({ title, heldOn, folder, transcript }: { title: string; heldOn: string; folder: string; transcript: string }) => {
    await addMeeting(board.id, title, heldOn, folder, transcript);
    trackEvent("meeting_added", { board_id: board.id, folder });
    setMeetings(await loadMeetings(board.id));
  };
  // Pins or unpins a Meetings folder for the whole board. Shown at once; put back if the save fails.
  const pinFolder = (folder: string, pin: boolean) => {
    const before = pinnedFolders;
    const next = pin ? [...before.filter((name) => name !== folder), folder] : before.filter((name) => name !== folder);
    setPinned(next);
    setPinnedFolders(board.id, next).catch((error) => {
      console.error(error);
      setPinned(before);
      window.alert(`Couldn't ${pin ? "pin" : "unpin"} ${folder}. ${error instanceof Error ? error.message : ""}`);
    });
  };
  const minutesEvent = (event: "edited" | "copied") => {
    trackEvent(event === "copied" ? "minutes_copied" : "minutes_edited", { board_id: board.id });
    if (event === "edited") loadMeetings(board.id).then(setMeetings).catch((error) => console.error(error));
  };
  // Accept approves the suggestion as shown; Reject dismisses it. Either way one suggestion_reviewed event
  // is sent, with the kind, the outcome and how many fields the suggestion changed. Never its content.
  const reviewed = (outcome: "accepted" | "rejected", suggestion: Suggestion) =>
    trackEvent("suggestion_reviewed", { board_id: board.id, kind: suggestion.kind, outcome, fields_changed: Object.keys(suggestion.changes).length });
  const reviewRows: ReviewRows | undefined = matchingOn ? {
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
  // Expanding a row also selects it, so the row stays highlighted and the map follows. Review rows are not
  // tickets yet, so the form's previous and next skip them.
  const expandTicket = (ticket: Ticket) => { setSelectedId(ticket.id); setExpandedId(ticket.id); };
  const expanded = tickets.find((ticket) => ticket.id === expandedId);
  const expandable = rows.filter((ticket) => !review.has(ticket.id));
  const expandedIndex = expanded ? expandable.indexOf(expanded) : -1;

  const onMapHover = useCallback((id: string | null) => setHover({ id, from: "map" }), []);
  // The table's Map cell opens the map on the ticket's first place; a place chip opens it on that place.
  const showOnMap = (id: string, place: number) => {
    setSelectedId(id);
    setSidebarOpen(true);
    setPanelTab("map");
    setMapFocus((current) => ({ ticketId: id, place, n: (current?.n ?? 0) + 1 }));
  };

  // The full-screen submit flow: no header, table or footer. Tickets are added to the same state and saved as usual.
  if (view === "submit" && intakeOn) {
    return <SubmitFlow onSubmit={addTicket} onExit={() => setView("home")} onStart={markIntakeStart} />;
  }

  if (view === "home" || mobile) {
    const mobileTickets = mobile && view === "tickets";
    return (
      <div className="portal">
        <PortalHeader view={mobile && view !== "tickets" ? "home" : view} setView={setView} account={account} mobile={mobile} />
        {mobileTickets ? (
          sync === "loading" || (sync === "error" && !tickets.length) ? (
            <main className="workspace-message">
              {sync === "loading" && "Loading tickets…"}
              {sync === "error" && "Couldn't load tickets. Check your connection and reload the page."}
            </main>
          ) : (
            // The desktop table, scrolled sideways and drawn larger (.mobile-table in index.css). No toolbar on phones: the + in the tab row starts a new ticket.
            <main className="workspace no-map mobile-table">
              <section className="records-pane">
                <UrgencyTabs tab={urgency} setTab={setUrgency} tickets={filtered} inReview={inReview} showReview={matchingOn} hideNonUrgent>
                  {intakeOn && <button type="button" className="tabs-new" aria-label="New ticket" title="New ticket" onClick={() => setView("submit")}><Plus size={14} /> New Ticket</button>}
                </UrgencyTabs>
                <TicketTable rows={rows} selectedId={review.has(selectedId) ? selectedId : selected?.id ?? ""} emptyMessage={urgency === "review" ? "Nothing to review." : tickets.length ? undefined : "No tickets yet."} hoveredId={hover.id} followHover={hover.from !== "table"} rowHeight={rowHeight} onHover={(id) => setHover({ id, from: "table" })} onSelect={selectTicket} onExpand={expandTicket} onChange={updateTicket} onDelete={removeTickets} transcript={transcriptColumn} review={reviewRows} />
              </section>
            </main>
          )
        ) : (
          <HomeView
            mobile={mobile}
            onShowMap={() => { setPanelTab("map"); setSidebarOpen(true); setView("tickets"); }}
            // The newest meeting; MeetingsPage opens it when meetingView is null.
            onMinutes={() => { setMeetingView(null); setView("meetings"); }}
            // Phones get the full-screen submit flow; wider screens open the form over the ticket table.
            onNewTicket={() => { if (mobile) { setView("submit"); } else { setView("tickets"); setIntakeOpen(true); } }}
          />
        )}
        {expanded && (
          <IntakeForm
            ticket={expanded}
            onChange={updateTicket}
            onStep={{
              prev: expandedIndex > 0 ? () => expandTicket(expandable[expandedIndex - 1]) : undefined,
              next: expandedIndex >= 0 && expandedIndex < expandable.length - 1 ? () => expandTicket(expandable[expandedIndex + 1]) : undefined,
            }}
            onClose={closeExpanded}
          />
        )}
        <PortalFooter />
      </div>
    );
  }

  // Block the screen only while loading or when loading failed; a board with no tickets yet gets the normal, empty table.
  if (sync === "loading" || (sync === "error" && !tickets.length)) {
    return (
      <div className="portal">
        <PortalHeader view={view} setView={setView} account={account} mobile={mobile} />
        <main className="workspace-message">
          {sync === "loading" && "Loading tickets…"}
          {sync === "error" && "Couldn't load tickets. Check your connection and reload the page."}
        </main>
        <PortalFooter />
      </div>
    );
  }

  const meetingsShown = view === "meetings" && meetingsOn;
  return (
    <div className="portal">
      <PortalHeader view={view} setView={setView} account={account} mobile={mobile} />
      {meetingsShown ? (
        <Suspense fallback={<main className="workspace-message">Loading meetings…</main>}>
          <MeetingsPage
            meetings={meetings}
            meetingId={meetingView === "list" ? null : meetingView ?? meetings[0]?.id ?? null}
            onOpenMeeting={(id) => setMeetingView(id ?? "list")}
            tickets={tickets}
            rows={withReview}
            suggestions={suggestions}
            review={reviewRows}
            selectedId={review.has(selectedId) ? selectedId : selected?.id ?? ""}
            hoveredId={hover.id}
            followHover={hover.from !== "table"}
            rowHeight={rowHeight}
            onHover={(id) => setHover({ id, from: "table" })}
            onSelect={(ticket) => setSelectedId(ticket.id)}
            onExpand={expandTicket}
            onChange={updateTicket}
            onDelete={removeTickets}
            onSpanChange={updateSpan}
            canEdit={board.role !== null}
            onGenerate={generateMeeting}
            onUpload={uploadMeeting}
            pinned={pinnedFolders}
            onPin={pinFolder}
            onMinutesEvent={minutesEvent}
            onViewed={() => trackEvent("meetings_opened", { board_id: board.id })}
          />
        </Suspense>
      ) : (
      <main className={`workspace ${!panelOn ? "no-map" : sidebarOpen ? "" : "sidebar-collapsed"}`}>
        <section className="records-pane">
          <UrgencyTabs tab={urgency} setTab={setUrgency} tickets={filtered} inReview={inReview} showReview={matchingOn} />
          <Toolbar count={rows.length} query={query} setQuery={setQuery} status={status} setStatus={setStatus} onNew={() => setIntakeOpen(true)} sync={sync} rowHeight={rowHeight} setRowHeight={setRowHeight} />
          <TicketTable rows={rows} selectedId={review.has(selectedId) ? selectedId : selected?.id ?? ""} emptyMessage={urgency === "review" ? "Nothing to review. Open a meeting in the Transcript tab and press Generate." : tickets.length ? undefined : intakeOn ? "No tickets yet. Add the first one with New ticket." : "No tickets yet."} hoveredId={hover.id} followHover={hover.from !== "table"} rowHeight={rowHeight} onHover={(id) => setHover({ id, from: "table" })} onSelect={selectTicket} onExpand={expandTicket} onChange={updateTicket} onShowOnMap={mapOn ? showOnMap : undefined} onDelete={removeTickets} transcript={transcriptColumn} review={reviewRows} />
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
      )}
      {intakeOpen && intakeOn && <IntakeForm onSubmit={addTicket} onClose={closeIntake} />}
      {expanded && (
        <IntakeForm
          ticket={expanded}
          onChange={updateTicket}
          onStep={{
            prev: expandedIndex > 0 ? () => expandTicket(expandable[expandedIndex - 1]) : undefined,
            next: expandedIndex >= 0 && expandedIndex < expandable.length - 1 ? () => expandTicket(expandable[expandedIndex + 1]) : undefined,
          }}
          onClose={closeExpanded}
        />
      )}
      <PortalFooter />
    </div>
  );
}
