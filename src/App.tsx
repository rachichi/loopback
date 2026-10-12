import { useCallback, useMemo, useState } from "react";
import { Filter, MapPin, ScrollText, Search, X } from "lucide-react";
import loopbackLogo from "./assets/logo.png";
import { initialTickets, statuses, withSpans, type Status, type Ticket } from "./goldTickets";
import type { Span } from "./transcript";
import TicketTable from "./TicketTable";
import TranscriptView from "./TranscriptView";
import MapView, { type MapFocus } from "./MapView";

function Logo() {
  return (
    <div className="brand-lockup" aria-label="Loopback and Manhattan Community Board 3 branding">
      <div className="loopback-logo" aria-label="Loopback">
        <img src={loopbackLogo} alt="Loopback logo" className="loopback-logo-image" />
      </div>
      <span className="brand-divider" aria-hidden="true">×</span>
      <div className="board-logo" aria-label="Manhattan Community Board 3">
        <img src="/mancb3_logo.png" alt="Manhattan Community Board 3 logo" className="board-logo-image" />
      </div>
    </div>
  );
}

function PortalHeader() {
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
      <div className="title-band">
        <div>
          <h1>Tickets</h1>
          <span>Review tickets from the meeting against the transcript and the map</span>
        </div>
      </div>
    </>
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

function Toolbar({
  count,
  query,
  setQuery,
  status,
  setStatus,
}: {
  count: number;
  query: string;
  setQuery: (value: string) => void;
  status: "All" | Status;
  setStatus: (value: "All" | Status) => void;
}) {
  return (
    <div className="table-toolbar">
      <strong className="table-count">{count} tickets</strong>
      <div className="toolbar-actions">
        <label className="table-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a ticket" /></label>
        <div className="filter-wrap">
          <Filter size={14} />
          <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as "All" | Status)}>
            <option>All</option>{statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedId, setSelectedId] = useState(initialTickets[0].id);
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Status>("All");
  const [sideTab, setSideTab] = useState<"transcript" | "map">("transcript");
  const [hover, setHover] = useState<{ id: string | null; from: "table" | "transcript" | "map" }>({ id: null, from: "table" });
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [jump, setJump] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });

  const rows = useMemo(() => tickets.filter((ticket) => {
    const matchesStatus = status === "All" || ticket.status === status;
    const search = query.toLowerCase();
    const matchesQuery = !search || `${ticket.number} ${ticket.title} ${ticket.type} ${ticket.location.text} ${ticket.location.places.map((place) => place.name).join(" ")} ${ticket.requester} ${ticket.summary}`.toLowerCase().includes(search);
    return matchesStatus && matchesQuery;
  }), [tickets, query, status]);

  const updateTicket = useCallback((id: string, patch: Partial<Ticket>) => {
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, ...patch } : ticket));
  }, []);
  const updateSpan = useCallback((id: string, index: number, span: Span) => {
    setTickets((current) => current.map((ticket) => ticket.id === id
      ? withSpans(ticket, ticket.spans.map((item, i) => i === index ? span : item))
      : ticket));
  }, []);

  // Selecting a ticket also asks the transcript to jump to its first evidence paragraph.
  const selectTicket = (ticket: Ticket) => {
    setSelectedId(ticket.id);
    setJump((current) => ({ id: ticket.id, n: current.n + 1 }));
  };

  const onTranscriptHover = useCallback((id: string | null) => setHover({ id, from: "transcript" }), []);
  const onMapHover = useCallback((id: string | null) => setHover({ id, from: "map" }), []);
  // A place chip in the table opens the map on that place.
  const showOnMap = (id: string, place: number) => {
    setSelectedId(id);
    setSideTab("map");
    setMapFocus((current) => ({ ticketId: id, place, n: (current?.n ?? 0) + 1 }));
  };

  return (
    <div className="portal">
      <PortalHeader />
      <main className="workspace">
        <section className="records-pane">
          <Toolbar count={rows.length} query={query} setQuery={setQuery} status={status} setStatus={setStatus} />
          <TicketTable rows={rows} selectedId={selected.id} hoveredId={hover.id} followHover={hover.from !== "table"} onHover={(id) => setHover({ id, from: "table" })} onSelect={selectTicket} onChange={updateTicket} onShowOnMap={showOnMap} />
        </section>
        <aside className="insights-pane">
          <div className="insights-tabs">
            <button className={sideTab === "transcript" ? "active" : ""} onClick={() => setSideTab("transcript")}><ScrollText size={15} /> Transcript</button>
            <button className={sideTab === "map" ? "active" : ""} onClick={() => setSideTab("map")}><MapPin size={15} /> Map</button>
          </div>
          {sideTab === "transcript" && <TranscriptView tickets={tickets} hoveredId={hover.id} onHover={onTranscriptHover} onSpanChange={updateSpan} jump={jump} />}
          {sideTab === "map" && <MapView tickets={tickets} selected={selected} hoveredId={hover.id} focus={mapFocus} onHover={onMapHover} onSelect={selectTicket} />}
        </aside>
      </main>
      <PortalFooter />
    </div>
  );
}
