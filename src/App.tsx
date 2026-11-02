import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ClipboardList, Filter, House, LogOut, MapPin, PanelRightClose, PanelRightOpen, Plus, Search, X } from "lucide-react";
import loopbackLogo from "./assets/logo.png";
import { statuses, type Status, type Ticket } from "./features/tickets/types";
import TicketTable from "./TicketTable";
import MapView, { type MapFocus } from "./MapView";
import IntakeForm, { type IntakeFields } from "./IntakeForm";
import type { Session } from "@supabase/supabase-js";
import { db } from "./db";
import { deleteTicket, insertTicket, loadTickets, updateTickets } from "./features/tickets/api";
import { BoardProvider, useBoard, useBoardSwitcher, type Role } from "./lib/board";
import SignIn from "./SignIn";

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

const roleLabel: Record<Role, string> = { platform_admin: "Platform admin", staff: "Staff", volunteer: "Volunteer (read only)" };

/** Right end of the nav: a board switcher when the user has more than one board, their role, and sign-out. */
function AccountControls() {
  const { id, role } = useBoard();
  const { boards, switchBoard } = useBoardSwitcher();
  return (
    <div className="nav-account">
      {boards.length > 1 && (
        <select className="board-switcher" aria-label="Switch board" value={id} onChange={(event) => switchBoard(event.target.value)}>
          {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
        </select>
      )}
      <span className={`role-badge ${role}`}>{roleLabel[role]}</span>
      <button type="button" className="nav-signout" onClick={() => void db.auth.signOut()}><LogOut size={15} /> Sign out</button>
    </div>
  );
}

function PortalHeader({ view, setView }: { view: View; setView: (view: View) => void }) {
  const [showNotice, setShowNotice] = useState(true);
  return (
    <>
      <header className={`portal-header ${showNotice ? "notice-header" : ""}`}>
        <div className="brand-block notice-brand">
          <Logo />
          {showNotice && <div className="construction-notice" role="status">
            <span>⚠️ This portal is under construction. Some features are still missing.</span>
            <button type="button" aria-label="Dismiss construction notice" onClick={() => setShowNotice(false)}><X size={18} /></button>
          </div>}
        </div>
      </header>
      <nav className="portal-nav">
        <button className={`nav-home ${view === "home" ? "active" : ""}`} aria-label="Home" aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}><House size={16} /></button>
        <button className={view === "tickets" ? "active" : ""} aria-current={view === "tickets" ? "page" : undefined} onClick={() => setView("tickets")}><ClipboardList size={15} /> Tickets</button>
        <AccountControls />
      </nav>
      {view === "tickets" && (
        <div className="title-band">
          <div>
            <h1>Tickets</h1>
            <span>Review and update tickets, and see where they are on the map</span>
          </div>
        </div>
      )}
    </>
  );
}

function HomeView({ onSearch, onShowMap, onLookUp, onNewTicket }: {
  onSearch: (query: string) => void;
  onShowMap: () => void;
  onLookUp: () => void;
  onNewTicket: () => void;
}) {
  const { name, backgroundUrl, canEdit } = useBoard();
  const [searchTerm, setSearchTerm] = useState("");
  const actions = [
    { label: "See Tickets on the Map", icon: MapPin, onClick: onShowMap },
    { label: "Look Up Tickets", icon: Search, onClick: onLookUp },
    ...(canEdit ? [{ label: "Submit a New Ticket", icon: Plus, onClick: onNewTicket }] : []),
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
            <form className="hero-search" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(searchTerm.trim()); }}>
              <input aria-label="Search tickets" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="I want to..." />
              <button aria-label="Search" type="submit"><Search size={24} strokeWidth={3} /></button>
            </form>
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

const urgencyTabs = [
  { key: "all", label: "All" },
  { key: "urgent", label: "Urgent" },
  { key: "non-urgent", label: "Non-urgent" },
] as const;
type UrgencyTab = (typeof urgencyTabs)[number]["key"];
const inTab = (ticket: Ticket, tab: UrgencyTab) => tab === "all" || ticket.urgent === (tab === "urgent");

function UrgencyTabs({ tab, setTab, tickets }: { tab: UrgencyTab; setTab: (tab: UrgencyTab) => void; tickets: Ticket[] }) {
  return (
    <div className="urgency-tabs" role="tablist" aria-label="Filter by urgency">
      {urgencyTabs.map((item) => (
        <button key={item.key} role="tab" aria-selected={tab === item.key} className={`${item.key} ${tab === item.key ? "active" : ""}`} onClick={() => setTab(item.key)}>
          {item.label} <span>{tickets.filter((ticket) => inTab(ticket, item.key)).length}</span>
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
  const { canEdit } = useBoard();
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
        {canEdit && <button type="button" className="new-request" onClick={onNew}><Plus size={14} /> New ticket</button>}
      </div>
    </div>
  );
}

/** Signed out: the sign-in screen. Signed in: the portal for the user's board, once it has loaded. */
export default function App() {
  // undefined until the stored session has been read, so a signed-in user never sees the sign-in screen flash.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (!session) return <SignIn />;
  // Keyed by user so signing in as someone else starts from a clean portal, not the last user's state.
  return (
    <BoardProvider key={session.user.id} userId={session.user.id}>
      <Portal />
    </BoardProvider>
  );
}

function Portal() {
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [view, setView] = useState<View>("home");

  // Search and status filters apply first, so each urgency tab's count matches what it shows.
  const filtered = useMemo(() => tickets.filter((ticket) => {
    const matchesStatus = status === "All" || ticket.status === status;
    const search = query.toLowerCase();
    const matchesQuery = !search || `${ticket.number} ${ticket.title} ${ticket.type} ${ticket.location.text} ${ticket.location.places.map((place) => place.name).join(" ")} ${ticket.requester} ${ticket.summary} ${ticket.submittedBy}`.toLowerCase().includes(search);
    return matchesStatus && matchesQuery;
  }), [tickets, query, status]);
  const rows = useMemo(() => filtered.filter((ticket) => inTab(ticket, urgency)), [filtered, urgency]);

  const updateTicket = useCallback((id: string, patch: Partial<Ticket>) => {
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, ...patch } : ticket));
  }, []);

  // New intake tickets go to the top, and the filters reset so the new row is in view.
  const addTicket = (fields: IntakeFields) => {
    // The database assigns the number when the ticket is inserted; until then it shows blank.
    // Every board shares one table, so ids must be unique across boards, not just within this one.
    const ticket: Ticket = { ...fields, id: crypto.randomUUID(), number: "", meetingIds: [], spans: [], evidence: {} };
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
      remove();
      setSync("saved");
    } catch (error) {
      console.error(error);
      setSync("error");
      window.alert(`Couldn't delete ticket ${label}. ${error instanceof Error ? error.message : ""}`);
    }
  };

  const selectTicket = (ticket: Ticket) => setSelectedId(ticket.id);

  const onMapHover = useCallback((id: string | null) => setHover({ id, from: "map" }), []);
  // The table's Map cell opens the map on the ticket's first place; a place chip opens it on that place.
  const showOnMap = (id: string, place: number) => {
    setSelectedId(id);
    setSidebarOpen(true);
    setMapFocus((current) => ({ ticketId: id, place, n: (current?.n ?? 0) + 1 }));
  };

  if (view === "home") {
    return (
      <div className="portal">
        <PortalHeader view={view} setView={setView} />
        <HomeView
          onSearch={(value) => { setQuery(value); setStatus("All"); setUrgency("all"); setView("tickets"); }}
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
        <PortalHeader view={view} setView={setView} />
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
      <PortalHeader view={view} setView={setView} />
      <main className={`workspace ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
        <section className="records-pane">
          <UrgencyTabs tab={urgency} setTab={setUrgency} tickets={filtered} />
          <Toolbar count={rows.length} query={query} setQuery={setQuery} status={status} setStatus={setStatus} onNew={() => setIntakeOpen(true)} sync={sync} />
          {/* Volunteers are read only: a disabled fieldset disables every control in the table at once. The
              database enforces this too (can_edit_board), so this only avoids offering edits that would fail. */}
          <fieldset className="ticket-fieldset" disabled={!board.canEdit}>
          <TicketTable rows={rows} selectedId={selected?.id ?? ""} emptyMessage={tickets.length ? undefined : board.canEdit ? "No tickets yet. Add the first one with New ticket." : "No tickets yet."} hoveredId={hover.id} followHover={hover.from !== "table"} onHover={(id) => setHover({ id, from: "table" })} onSelect={selectTicket} onChange={updateTicket} onShowOnMap={showOnMap} onDelete={board.canEdit ? removeTicket : undefined} />
          </fieldset>
        </section>
        {sidebarOpen ? (
          <aside className="insights-pane">
            <div className="insights-tabs">
              <button className="active"><MapPin size={15} /> Map</button>
              <button type="button" className="sidebar-toggle" aria-label="Collapse map" title="Collapse map" onClick={() => setSidebarOpen(false)}><PanelRightClose size={16} /></button>
            </div>
            <MapView tickets={tickets} selected={selected} hoveredId={hover.id} focus={mapFocus} onHover={onMapHover} onSelect={selectTicket} />
          </aside>
        ) : (
          // Collapsed: a slim rail that reopens the panel, optionally straight to one tab.
          <aside className="insights-rail" aria-label="Map (collapsed)">
            <button type="button" aria-label="Expand map" title="Expand map" onClick={() => setSidebarOpen(true)}><PanelRightOpen size={16} /></button>
            <button type="button" aria-label="Open map" title="Map" onClick={() => setSidebarOpen(true)}><MapPin size={16} /></button>
          </aside>
        )}
      </main>
      {intakeOpen && board.canEdit && <IntakeForm onSubmit={addTicket} onClose={closeIntake} />}
      <PortalFooter />
    </div>
  );
}
