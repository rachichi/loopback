import { useMemo, useState, type ReactNode } from "react";
import loopbackLogo from "./assets/logo.png";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileText,
  Filter,
  FolderOpen,
  House,
  LayoutDashboard,
  Link2,
  Mail,
  Map,
  MapPin,
  Menu,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Upload,
  Users,
  X,
} from "lucide-react";

type TicketType =
  | "Liquor license"
  | "Proposal"
  | "Service request"
  | "Complaint"
  | "Land use"
  | "Budget";
type Status = "To do" | "In progress" | "Complete";
type Source = "SMS" | "Transcript" | "Email";

type Ticket = {
  number: string;
  title: string;
  type: TicketType;
  status: Status;
  source: Source;
  document: string;
  owner: string;
  role: string;
  nextSteps: string[];
  location: string;
  coordinates: [number, number];
  created: string;
};

const mapBounds = {
  minLat: 40.719,
  maxLat: 40.737,
  minLng: -73.997,
  maxLng: -73.972,
};

const projectMapCoordinates = (lat: number, lng: number) => ({
  x: ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * 100,
  y: ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * 100,
});

const tickets: Ticket[] = [
  {
    number: "CB3-001",
    title: "Third Avenue L stop closure proposal",
    type: "Service request",
    status: "In progress",
    source: "Transcript",
    document: "CB3 meeting transcript",
    owner: "Transportation Committee",
    role: "Transit advocacy",
    nextSteps: ["Request MTA review", "Add to transportation agenda", "Measure rider impact"],
    location: "Third Ave & 14th St",
    coordinates: [40.7341, -73.9873],
    created: "Sep 30",
  },
  {
    number: "CB3-002",
    title: "Delivery worker bike congestion on 11th Street",
    type: "Complaint",
    status: "In progress",
    source: "Transcript",
    document: "Public speaking comment",
    owner: "9th Precinct",
    role: "Enforcement coordination",
    nextSteps: ["Renew enforcement on 11th St", "Coordinate sanitation cleanup", "Monitor corridor conditions"],
    location: "11th St & Avenue A",
    coordinates: [40.7288, -73.9805],
    created: "Sep 30",
  },
  {
    number: "CB3-003",
    title: "Illegal bike storage in the East Village corridor",
    type: "Complaint",
    status: "To do",
    source: "Transcript",
    document: "Public speaking comment",
    owner: "Community board liaison",
    role: "Neighborhood operations",
    nextSteps: ["Distribute flyers", "Coordinate with DOT and NYPD", "Track repeat violations"],
    location: "East Village / 11th Street corridor",
    coordinates: [40.7275, -73.9848],
    created: "Sep 30",
  },
  {
    number: "CB3-004",
    title: "Beer and wine license stipulation review",
    type: "Liquor license",
    status: "In progress",
    source: "Transcript",
    document: "Licensing motion",
    owner: "Licensing Committee",
    role: "Licensing review",
    nextSteps: ["Confirm stipulation details", "Follow up with applicant", "Record board recommendation"],
    location: "E 11th St & 2nd Ave",
    coordinates: [40.7299, -73.9861],
    created: "Sep 30",
  },
];

const typeClass: Record<TicketType, string> = {
  "Liquor license": "purple",
  Proposal: "green",
  "Service request": "blue",
  Complaint: "orange",
  "Land use": "teal",
  Budget: "yellow",
};

function Logo() {
  return (
    <div className="loopback-logo" aria-label="Loopback">
      <img src={loopbackLogo} alt="Loopback logo" className="loopback-logo-image" />
    </div>
  );
}

function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`tag ${className}`}>{children}</span>;
}

function PortalHeader() {
  return (
    <>
      <header className="portal-header">
        <button className="mobile-menu" aria-label="Open navigation"><Menu size={20} /></button>
        <div className="brand-block">
          <Logo />
          <div className="brand-text">Community Board 3 Portal</div>
        </div>
        <div className="header-actions">
          <button aria-label="Notifications"><Bell size={17} /></button>
          <span>CB3</span>
        </div>
      </header>
      <nav className="portal-nav">
        <button className="nav-home" aria-label="Home"><House size={16} /></button>
        <button className="active"><ClipboardList size={15} /> Tickets</button>
        <button><CalendarDays size={15} /> Calendar</button>
        <button><Users size={15} /> Roles</button>
        <button><CircleHelp size={15} /> Resources</button>
        <label><Search size={15} /><input placeholder="Search" /></label>
      </nav>
      <div className="title-band">
        <div><h1>Tickets</h1><span>Community Board 3 service tracker</span></div>
        <Tag className="sample">Community Board 3</Tag>
      </div>
    </>
  );
}

function Toolbar({
  query,
  setQuery,
  status,
  setStatus,
}: {
  query: string;
  setQuery: (value: string) => void;
  status: "All" | Status;
  setStatus: (value: "All" | Status) => void;
}) {
  return (
    <div className="table-toolbar">
      <button className="view-name"><LayoutDashboard size={15} /><strong>All tickets</strong><ChevronDown size={13} /></button>
      <div className="toolbar-actions">
        <label className="table-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a ticket" /></label>
        <div className="filter-wrap">
          <Filter size={14} />
          <select value={status} onChange={(event) => setStatus(event.target.value as "All" | Status)}>
            <option>All</option><option>To do</option><option>In progress</option><option>Complete</option>
          </select>
        </div>
        <button title="Sort"><SlidersHorizontal size={15} /></button>
        <button title="More options"><MoreHorizontal size={16} /></button>
      </div>
    </div>
  );
}

function TicketTable({
  rows,
  selected,
  onSelect,
}: {
  rows: Ticket[];
  selected: Ticket;
  onSelect: (ticket: Ticket) => void;
}) {
  return (
    <div className="table-scroll">
      <div className="ticket-grid ticket-head">
        <div className="check-cell"><input type="checkbox" aria-label="Select all" /></div>
        <div>Service Number</div><div>Title</div><div>Type</div><div>Status</div>
        <div>Source</div><div>Supporting Documentation</div>
      </div>
      {rows.length ? rows.map((ticket) => (
        <button
          className={`ticket-grid ticket-row ${selected.number === ticket.number ? "selected" : ""}`}
          key={ticket.number}
          onClick={() => onSelect(ticket)}
        >
          <div className="check-cell"><input type="checkbox" aria-label={`Select ${ticket.number}`} onClick={(event) => event.stopPropagation()} /></div>
          <div className="service-number"><span>{ticket.number}</span><small>{ticket.created}</small></div>
          <div className="ticket-title">{ticket.title}<small><MapPin size={10} /> {ticket.location}</small></div>
          <div><Tag className={`type ${typeClass[ticket.type]}`}>{ticket.type}</Tag></div>
          <div><Tag className={`status ${ticket.status.toLowerCase().replace(" ", "-")}`}><i />{ticket.status}</Tag></div>
          <div><Tag className="source">{ticket.source}</Tag></div>
          <div className="document-link"><Paperclip size={13} />{ticket.document}</div>
        </button>
      )) : <div className="empty-results">No tickets match this view.</div>}
    </div>
  );
}

function TicketInspector({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  return (
    <section className="ticket-inspector">
      <div className="inspector-heading">
        <div><Tag className={`type ${typeClass[ticket.type]}`}>{ticket.type}</Tag><span>{ticket.number}</span><h2>{ticket.title}</h2></div>
        <button onClick={onClose} aria-label="Close ticket details"><X size={17} /></button>
      </div>
      <div className="inspector-content">
        <div className="owner-block">
          <span className="owner-avatar">{ticket.owner.split(" ").map((part) => part[0]).join("")}</span>
          <div><small>SUGGESTED OWNER</small><strong>{ticket.owner}</strong><p>{ticket.role}</p></div>
        </div>
        <div className="steps-block">
          <small>SUGGESTED NEXT STEPS</small>
          <ul>{ticket.nextSteps.map((step) => <li key={step}><span><Check size={10} /></span>{step}</li>)}</ul>
        </div>
        <div className="record-actions">
          <button className="primary-action">Open ticket <ChevronRight size={14} /></button>
          <button><Mail size={14} /> Contact owner</button>
        </div>
      </div>
    </section>
  );
}

function MapView({ selected, onSelect }: { selected: Ticket; onSelect: (ticket: Ticket) => void }) {
  const pinPositions = tickets.map((ticket) => {
    const { x, y } = projectMapCoordinates(ticket.coordinates[0], ticket.coordinates[1]);
    return { ...ticket, x, y };
  });

  return (
    <div className="map-view">
      <div className="map-canvas">
        <div className="map-embed-shell">
          <iframe
            title="NYC Boundaries map for Community Board 3"
            src="https://boundaries.beta.nyc/?map=cd&dist=103"
            className="map-embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="map-pin-layer">
          {pinPositions.map((ticket, index) => (
            <button
              key={ticket.number}
              className={`map-pin ${selected.number === ticket.number ? "active" : ""}`}
              style={{ left: `${ticket.x}%`, top: `${ticket.y}%` }}
              onClick={() => onSelect(ticket)}
              aria-label={`Show ${ticket.title}`}
            >
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="map-record">
        <span className="marker-number">{tickets.findIndex((item) => item.number === selected.number) + 1}</span>
        <div><strong>{selected.title}</strong><p><MapPin size={11} /> {selected.location}</p></div>
        <Tag className={`status ${selected.status.toLowerCase().replace(" ", "-")}`}>{selected.status}</Tag>
      </div>
    </div>
  );
}

function SummaryView({ rows }: { rows: Ticket[] }) {
  const statuses = (["To do", "In progress", "Complete"] as Status[]).map((status) => ({
    status,
    count: rows.filter((ticket) => ticket.status === status).length,
  }));
  const types = (Object.keys(typeClass) as TicketType[]).map((type) => ({
    type,
    count: rows.filter((ticket) => ticket.type === type).length,
  })).filter((item) => item.count);
  const maxType = Math.max(...types.map((item) => item.count), 1);
  return (
    <div className="summary-view">
      <div className="summary-heading"><div><h2>Ticket overview</h2><p>Dashboard for the current left-hand view</p></div></div>
      <div className="metric-row">
        <article><span>VISIBLE TICKETS</span><strong>{rows.length}</strong><small>Current filtered view</small></article>
        <article><span>IN PROGRESS</span><strong>{statuses.find((item) => item.status === "In progress")?.count || 0}</strong><small>Need staff follow-up</small></article>
        <article><span>COMPLETE</span><strong>{statuses.find((item) => item.status === "Complete")?.count || 0}</strong><small>This reporting period</small></article>
      </div>
      <section className="summary-card">
        <div className="card-heading"><h3>Status</h3><span>{rows.length} total</span></div>
        <div className="donut-layout">
          <div className="donut" style={{
            background: `conic-gradient(#e5a419 0 ${(statuses[0].count / Math.max(rows.length, 1)) * 100}%, #2a93c9 0 ${((statuses[0].count + statuses[1].count) / Math.max(rows.length, 1)) * 100}%, #2d9b65 0)`,
          }}><span><strong>{rows.length}</strong>tickets</span></div>
          <div className="status-legend">{statuses.map((item) => <div key={item.status}><i className={item.status.toLowerCase().replace(" ", "-")} /><span>{item.status}</span><strong>{item.count}</strong></div>)}</div>
        </div>
      </section>
      <section className="summary-card">
        <div className="card-heading"><h3>Tickets by type</h3><span>Current view</span></div>
        <div className="type-bars">{types.map((item) => <div key={item.type}><span>{item.type}</span><div><i className={typeClass[item.type]} style={{ width: `${(item.count / maxType) * 100}%` }} /></div><strong>{item.count}</strong></div>)}</div>
      </section>
      <section className="source-summary">
        <h3>Source mix</h3>
        {(["SMS", "Transcript", "Email"] as Source[]).map((source) => <div key={source}><span className={`source-icon ${source.toLowerCase()}`}>{source === "SMS" ? "#" : source === "Transcript" ? <FileText size={13} /> : <Mail size={13} />}</span><strong>{source}</strong><b>{rows.filter((ticket) => ticket.source === source).length}</b></div>)}
      </section>
    </div>
  );
}

export default function App() {
  const [selected, setSelected] = useState(tickets[0]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Status>("All");
  const [sideTab, setSideTab] = useState<"map" | "summary">("map");
  const [showInspector, setShowInspector] = useState(true);

  const rows = useMemo(() => tickets.filter((ticket) => {
    const matchesStatus = status === "All" || ticket.status === status;
    const search = query.toLowerCase();
    const matchesQuery = !search || `${ticket.number} ${ticket.title} ${ticket.type} ${ticket.location}`.toLowerCase().includes(search);
    return matchesStatus && matchesQuery;
  }), [query, status]);

  const selectTicket = (ticket: Ticket) => {
    setSelected(ticket);
    setShowInspector(true);
  };

  return (
    <div className="portal">
      <PortalHeader />
      <main className="workspace">
        <section className="records-pane">
          <Toolbar query={query} setQuery={setQuery} status={status} setStatus={setStatus} />
          <div className="view-strip"><span><i /> Grid view</span><strong>{rows.length} records</strong><button><Plus size={14} /> Add ticket</button></div>
          <TicketTable rows={rows} selected={selected} onSelect={selectTicket} />
          {showInspector && <TicketInspector ticket={selected} onClose={() => setShowInspector(false)} />}
        </section>
        <aside className="insights-pane">
          <div className="insights-tabs">
            <button className={sideTab === "map" ? "active" : ""} onClick={() => setSideTab("map")}><Map size={15} /> Map</button>
            <button className={sideTab === "summary" ? "active" : ""} onClick={() => setSideTab("summary")}><BarChart3 size={15} /> Summary</button>
          </div>
          {sideTab === "map" ? <MapView selected={selected} onSelect={selectTicket} /> : <SummaryView rows={rows} />}
        </aside>
      </main>
    </div>
  );
}
