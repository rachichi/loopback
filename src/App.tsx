import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Filter, House, MapPin, PanelRightClose, PanelRightOpen, Plus, ScrollText, Search, X } from "lucide-react";
import loopbackLogo from "./assets/logo.png";
import { initialTickets, statuses, withSpans, type EvidenceSpan, type Status, type Ticket } from "./goldTickets";
import TicketTable from "./TicketTable";
import TranscriptView from "./TranscriptView";
import MapView, { type MapFocus } from "./MapView";
import IntakeForm, { type IntakeFields } from "./IntakeForm";
import { meetingById, meetings } from "./meetings";
import { db, loadTickets, saveTickets } from "./db";

/** Where the tickets live: bundled sample data (no database configured) or Supabase. */
type Sync = "sample" | "loading" | "saving" | "saved" | "error";
const syncLabel: Record<Sync, string> = {
  sample: "Sample data · changes aren't saved",
  loading: "Loading…",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't reach the database",
};

function Logo() {
  return (
    <div className="brand-lockup" aria-label="Loopback and Brooklyn Community Board 9 branding">
      <div className="loopback-logo" aria-label="Loopback">
        <img src={loopbackLogo} alt="Loopback logo" className="loopback-logo-image" />
      </div>
      <span className="brand-divider" aria-hidden="true">×</span>
      <div className="board-logo" aria-label="Brooklyn Community Board 9">
        <img src="/bklyncb9_logo.jpeg" alt="Brooklyn Community Board 9 logo" className="board-logo-image" />
      </div>
    </div>
  );
}

type View = "home" | "tickets";

function PortalHeader({ view, setView }: { view: View; setView: (view: View) => void }) {
  const [showNotice, setShowNotice] = useState(true);
  return (
    <>
      <header className={`portal-header ${showNotice ? "notice-header" : ""}`}>
        <div className="brand-block notice-brand">
          <Logo />
          {showNotice && <div className="construction-notice" role="status">
            <span>⚠️ This portal is under construction and currently only uses sample data.</span>
            <button type="button" aria-label="Dismiss construction notice" onClick={() => setShowNotice(false)}><X size={18} /></button>
          </div>}
        </div>
      </header>
      <nav className="portal-nav">
        <button className={`nav-home ${view === "home" ? "active" : ""}`} aria-label="Home" aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}><House size={16} /></button>
        <button className={view === "tickets" ? "active" : ""} aria-current={view === "tickets" ? "page" : undefined} onClick={() => setView("tickets")}><ClipboardList size={15} /> Tickets</button>
      </nav>
      {view === "tickets" && (
        <div className="title-band">
          <div>
            <h1>Tickets</h1>
            <span>Review tickets from the meeting against the transcript and the map</span>
          </div>
        </div>
      )}
    </>
  );
}

function HomeView({ onSearch, onReviewTranscript, onLookUp, onNewTicket }: {
  onSearch: (query: string) => void;
  onReviewTranscript: () => void;
  onLookUp: () => void;
  onNewTicket: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const actions = [
    { label: "Review Meeting Transcript", icon: ScrollText, onClick: onReviewTranscript },
    { label: "Look Up Tickets", icon: Search, onClick: onLookUp },
    { label: "Submit a New Ticket", icon: Plus, onClick: onNewTicket },
  ];
  return (
    <main className="home-view">
      <div className="hero-banner" aria-label="Home page banner">
        <div className="hero-content">
          <div className="hero-primary">
            <div className="hero-copy">
              <h1>hey cb9 👋,<br />how can we<br />help you?</h1>
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
  return (
    <footer className="portal-footer">
      <div className="portal-footer-inner">
        <img src={loopbackLogo} alt="Loopback" />
        <div className="portal-footer-contact">
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
        <button type="button" className="new-request" onClick={onNew}><Plus size={14} /> New ticket</button>
      </div>
    </div>
  );
}

export default function App() {
  const [tickets, setTickets] = useState(db ? [] : initialTickets);
  const [selectedId, setSelectedId] = useState(db ? "" : initialTickets[0].id);
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0];
  const [sync, setSync] = useState<Sync>(db ? "loading" : "sample");

  // The last version of each ticket known to be in the database; a ticket whose object differs has unsaved edits.
  const persisted = useRef(new Map<string, Ticket>());
  useEffect(() => {
    if (!db) return;
    loadTickets()
      .then((loaded) => {
        for (const ticket of loaded) persisted.current.set(ticket.id, ticket);
        setTickets(loaded);
        setSelectedId(loaded[0]?.id ?? "");
        setSync("saved");
      })
      .catch((error) => { console.error(error); setSync("error"); });
  }, []);
  // Save edits shortly after typing stops; a failed save is retried with the next edit.
  useEffect(() => {
    if (!db) return;
    const changed = tickets.filter((ticket) => persisted.current.get(ticket.id) !== ticket);
    if (!changed.length) return;
    setSync("saving");
    const timer = window.setTimeout(() => {
      saveTickets(changed)
        .then(() => {
          for (const ticket of changed) persisted.current.set(ticket.id, ticket);
          setSync("saved");
        })
        .catch((error) => { console.error(error); setSync("error"); });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [tickets]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Status>("All");
  const [sideTab, setSideTab] = useState<"transcript" | "map">("transcript");
  const [hover, setHover] = useState<{ id: string | null; from: "table" | "transcript" | "map" }>({ id: null, from: "table" });
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [jump, setJump] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  const [urgency, setUrgency] = useState<UrgencyTab>("all");
  // The transcript and map panel starts collapsed so the tickets get the full width.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  const [meetingId, setMeetingId] = useState(meetings[0].id);
  const meeting = meetingById(meetingId) ?? meetings[0];

  // Search and status filters apply first, so each urgency tab's count matches what it shows.
  const filtered = useMemo(() => tickets.filter((ticket) => {
    const matchesStatus = status === "All" || ticket.status === status;
    const search = query.toLowerCase();
    const matchesQuery = !search || `${ticket.number} ${ticket.title} ${ticket.type} ${ticket.location.text} ${ticket.location.places.map((place) => place.name).join(" ")} ${ticket.requester} ${ticket.summary} ${ticket.submittedBy} ${ticket.meetingIds.map((id) => meetingById(id)?.label).join(" ")}`.toLowerCase().includes(search);
    return matchesStatus && matchesQuery;
  }), [tickets, query, status]);
  const rows = useMemo(() => filtered.filter((ticket) => inTab(ticket, urgency)), [filtered, urgency]);

  const updateTicket = useCallback((id: string, patch: Partial<Ticket>) => {
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, ...patch } : ticket));
  }, []);
  const updateSpan = useCallback((id: string, index: number, span: EvidenceSpan) => {
    setTickets((current) => current.map((ticket) => ticket.id === id
      ? withSpans(ticket, ticket.spans.map((item, i) => i === index ? span : item))
      : ticket));
  }, []);

  // New intake tickets go to the top, and the filters reset so the new row is in view.
  const addTicket = (fields: IntakeFields) => {
    const number = String(Math.max(0, ...tickets.map((ticket) => Number(ticket.number) || 0)) + 1);
    // Every board shares one table, so ids must be unique across boards, not just within this one.
    const ticket: Ticket = { ...fields, id: crypto.randomUUID(), number, meetingIds: [], spans: [], evidence: {} };
    setTickets((current) => [ticket, ...current]);
    setSelectedId(ticket.id);
    setQuery("");
    setStatus("All");
    setUrgency("all");
    setIntakeOpen(false);
  };
  const closeIntake = useCallback(() => setIntakeOpen(false), []);

  // Selecting a ticket also jumps the transcript to its first evidence paragraph. The transcript stays on
  // the meeting it shows if the ticket was discussed there, and otherwise turns to the latest one that it was.
  const selectTicket = (ticket: Ticket, inMeeting?: string) => {
    setSelectedId(ticket.id);
    const target = inMeeting ?? (ticket.meetingIds.includes(meetingId) ? meetingId : ticket.meetingIds.at(-1));
    if (target) setMeetingId(target);
    setJump((current) => ({ id: ticket.id, n: current.n + 1 }));
  };
  // The table's Transcript cell opens the transcript; a meeting tag in it opens that meeting's.
  const showTranscript = (ticket: Ticket, inMeeting?: string) => {
    selectTicket(ticket, inMeeting);
    setSideTab("transcript");
    setSidebarOpen(true);
  };

  const onTranscriptHover = useCallback((id: string | null) => setHover({ id, from: "transcript" }), []);
  const onMapHover = useCallback((id: string | null) => setHover({ id, from: "map" }), []);
  // The table's Map cell opens the map on the ticket's first place; a place chip opens it on that place.
  const showOnMap = (id: string, place: number) => {
    setSelectedId(id);
    setSideTab("map");
    setSidebarOpen(true);
    setMapFocus((current) => ({ ticketId: id, place, n: (current?.n ?? 0) + 1 }));
  };

  if (view === "home") {
    return (
      <div className="portal">
        <PortalHeader view={view} setView={setView} />
        <HomeView
          onSearch={(value) => { setQuery(value); setStatus("All"); setUrgency("all"); setView("tickets"); }}
          onReviewTranscript={() => { setSideTab("transcript"); setSidebarOpen(true); setView("tickets"); }}
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
          {sync === "error" && "Couldn't load tickets from Supabase. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, and that supabase/schema.sql has been run."}
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
          <TicketTable rows={rows} selectedId={selected?.id ?? ""} emptyMessage={tickets.length ? undefined : "No tickets yet. Add the first one with New ticket."} hoveredId={hover.id} followHover={hover.from !== "table"} onHover={(id) => setHover({ id, from: "table" })} onSelect={selectTicket} onChange={updateTicket} onShowOnMap={showOnMap} onShowTranscript={showTranscript} />
        </section>
        {sidebarOpen ? (
          <aside className="insights-pane">
            <div className="insights-tabs">
              <button className={sideTab === "transcript" ? "active" : ""} onClick={() => setSideTab("transcript")}><ScrollText size={15} /> Transcript</button>
              <button className={sideTab === "map" ? "active" : ""} onClick={() => setSideTab("map")}><MapPin size={15} /> Map</button>
              <button type="button" className="sidebar-toggle" aria-label="Collapse transcript and map" title="Collapse transcript and map" onClick={() => setSidebarOpen(false)}><PanelRightClose size={16} /></button>
            </div>
            {sideTab === "transcript" && <TranscriptView meetings={meetings} meeting={meeting} onMeetingChange={setMeetingId} tickets={tickets} hoveredId={hover.id} onHover={onTranscriptHover} onSpanChange={updateSpan} jump={jump} />}
            {sideTab === "map" && <MapView tickets={tickets} selected={selected} hoveredId={hover.id} focus={mapFocus} onHover={onMapHover} onSelect={selectTicket} />}
          </aside>
        ) : (
          // Collapsed: a slim rail that reopens the panel, optionally straight to one tab.
          <aside className="insights-rail" aria-label="Transcript and map (collapsed)">
            <button type="button" aria-label="Expand transcript and map" title="Expand transcript and map" onClick={() => setSidebarOpen(true)}><PanelRightOpen size={16} /></button>
            <button type="button" aria-label="Open transcript" title="Transcript" onClick={() => { setSideTab("transcript"); setSidebarOpen(true); }}><ScrollText size={16} /></button>
            <button type="button" aria-label="Open map" title="Map" onClick={() => { setSideTab("map"); setSidebarOpen(true); }}><MapPin size={16} /></button>
          </aside>
        )}
      </main>
      {intakeOpen && <IntakeForm onSubmit={addTicket} onClose={closeIntake} />}
      <PortalFooter />
    </div>
  );
}
