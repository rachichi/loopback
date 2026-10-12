import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import loopbackLogo from "./assets/logo.png";
import { initialTickets, statusClass, statuses, ticketTypes, typeClass, withSpans, type Source, type Status, type Ticket } from "./goldTickets";
import type { Span } from "./transcript";
import TicketTable from "./TicketTable";
import TranscriptView from "./TranscriptView";
import { siBlogger, siFacebook, siInstagram, siX } from "simple-icons";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileText,
  Filter,
  FolderOpen,
  House,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Menu,
  MoreHorizontal,
  Paperclip,
  Play,
  Plus,
  ScrollText,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";

const mapBounds = {
  minLat: 40.707,
  maxLat: 40.737,
  minLng: -74.002,
  maxLng: -73.971,
};

const projectMapCoordinates = (lat: number, lng: number) => ({
  x: ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * 100,
  y: ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * 100,
});

const calendarEvents = [
  {
    date: "2026-10-08",
    title: "Health, Seniors, & Human Services / Youth, Education, & Human Rights Committee",
    time: "6:30pm",
    location: "Office - 59 East 4th Street",
    description: "Hybrid meeting on district needs, public services, and future agenda planning.",
  },
  {
    date: "2026-10-13",
    title: "Transportation, Public Safety, Sanitation & Environment Committee",
    time: "6:30pm",
    location: "Confucius Plaza Community Room - 33 Bowery",
    description: "Transportation safety updates, environmental priorities, and district planning discussion.",
  },
  {
    date: "2026-10-14",
    title: "Land Use, Zoning, Public & Private Housing Committee",
    time: "6:30pm",
    location: "Middle Collegiate Church - 50 East 7th Street",
    description: "Housing and land use agenda items, including development review and public hearing updates.",
  },
  {
    date: "2026-10-15",
    title: "Parks, Recreation, Waterfront, & Resiliency Committee",
    time: "6:30pm",
    location: "BRC Senior Services Center - 30 Delancey Street",
    description: "Park improvements, resiliency planning, and civic updates for East Village and Lower East Side.",
  },
  {
    date: "2026-10-19",
    title: "SLA Licensing & Outdoor Dining Committee",
    time: "6:30pm",
    location: "Office - 59 East 4th Street",
    description: "Licensing and outdoor dining applications, plus agenda items for committee review.",
  },
  {
    date: "2026-10-22",
    title: "Executive Committee",
    time: "6:30pm",
    location: "Office - 59 East 4th Street",
    description: "Board leadership discussion and follow-up on committee priorities.",
  },
  {
    date: "2026-10-27",
    title: "Full Board Meeting",
    time: "6:30pm",
    location: "PS 20 - 166 Essex Street",
    description: "Full board agenda with district-wide business, public agenda items, and voting items.",
  },
];

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

function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`tag ${className}`}>{children}</span>;
}

type TabName = "home" | "tickets" | "calendar" | "templates" | "outreach" | "forum";
type TicketView = "list" | "kanban" | "roadmap";
type OutreachChannel = "Instagram" | "Facebook" | "X" | "Blog" | "Newsletter";

type OutreachEntry = {
  number: string;
  title: string;
  type: "Resolution" | "Community event" | "District win";
  status: "Ready" | "Posted";
  source: string;
  attachments: Array<{ name: string; kind: "Image" | "Video" }>;
};

const outreachEntries: OutreachEntry[] = [
  { number: "001", title: "Resolution supporting safer school streets", type: "Resolution", status: "Ready", source: "Full Board Meeting · Sep 24", attachments: [{ name: "School streets photo.jpg", kind: "Image" }] },
  { number: "002", title: "Lower East Side community cleanup", type: "Community event", status: "Ready", source: "Sanitation Committee · Sep 18", attachments: [{ name: "Cleanup highlights.mp4", kind: "Video" }, { name: "Volunteer group.jpg", kind: "Image" }] },
  { number: "003", title: "New cooling resources shared with residents", type: "District win", status: "Posted", source: "Health Committee · Sep 12", attachments: [{ name: "Cooling center.jpg", kind: "Image" }] },
  { number: "004", title: "Resolution calling for protected bike lanes", type: "Resolution", status: "Ready", source: "Transportation Committee · Sep 09", attachments: [{ name: "Avenue corridor.mp4", kind: "Video" }] },
];

const outreachChannels: OutreachChannel[] = ["Instagram", "Facebook", "X", "Blog", "Newsletter"];

const outreachChannelIconData = {
  Instagram: siInstagram,
  Facebook: siFacebook,
  X: siX,
  Blog: siBlogger,
};

const defaultOutreachCopy = (channel: OutreachChannel, entry: OutreachEntry) => {
  const opening = `A community update from Manhattan Community Board 3: ${entry.title}.`;
  const detail = "Thank you to the neighbors, volunteers, and city partners who helped move this work forward.";
  if (channel === "X") return `${opening} ${detail} #ManhattanCB3`;
  if (channel === "Blog") return `${opening}\n\n${detail} Read the meeting notes and learn how to get involved at our next community board meeting.`;
  if (channel === "Newsletter") return `${opening}\n\n${detail}\n\nStay connected with Manhattan CB3 for meeting updates, public events, and ways to participate.`;
  return `${opening}\n\n${detail}\n\nLearn more and join the conversation at an upcoming community board meeting. #ManhattanCB3`;
};

function OutreachChannelIcon({ channel }: { channel: OutreachChannel }) {
  const iconData = channel === "Newsletter" ? undefined : outreachChannelIconData[channel as keyof typeof outreachChannelIconData];
  return iconData ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d={iconData.path} /></svg> : <Mail className="outreach-newsletter-icon" size={15} aria-hidden="true" />;
}

const tabDetails: Partial<Record<TabName, { title: string; subtitle: string }>> = {
  tickets: { title: "Tickets", subtitle: "Check, edit, and update status of existing tickets" },
  calendar: { title: "Calendar", subtitle: "Keep track of upcoming proposed and confirmed events" },
  templates: { title: "Templates", subtitle: "View document templates created by fellow community board members." },
  outreach: { title: "Outreach", subtitle: "Share your community board's wins. You deserve it" },
  forum: { title: "Forum", subtitle: "Post questions and answers to fellow community board members." },
};

function PortalHeader({ activeTab, setActiveTab }: { activeTab: TabName; setActiveTab: (tab: TabName) => void }) {
  const [showHomeNotice, setShowHomeNotice] = useState(true);

  return (
    <>
      <header className={`portal-header ${showHomeNotice ? "notice-header" : ""}`}>
        <button className="mobile-menu" aria-label="Open navigation"><Menu size={20} /></button>
        <div className="brand-block notice-brand">
          <Logo />
          {showHomeNotice && <div className="construction-notice" role="status">
            <span>⚠️ This portal is under construction and currently only uses sample data.</span>
            <button type="button" aria-label="Dismiss construction notice" onClick={() => setShowHomeNotice(false)}><X size={18} /></button>
          </div>}
        </div>
        <div className="header-actions">
          <button aria-label="Notifications"><Bell size={17} /></button>
          <span>P</span>
        </div>
      </header>
      <nav className="portal-nav">
        <button className={activeTab === "home" ? "nav-home active" : "nav-home"} onClick={() => setActiveTab("home")} aria-label="Home"><House size={16} /></button>
        <button className={activeTab === "tickets" ? "active" : ""} onClick={() => setActiveTab("tickets")}><ClipboardList size={15} /> Tickets</button>
        <button className={activeTab === "calendar" ? "active" : ""} onClick={() => setActiveTab("calendar")}><CalendarDays size={15} /> Calendar</button>
        <button className={activeTab === "templates" ? "active" : ""} onClick={() => setActiveTab("templates")}><FileText size={15} /> Templates</button>
        <button className={activeTab === "outreach" ? "active" : ""} onClick={() => setActiveTab("outreach")}><Users size={15} /> Outreach</button>
        <button className={activeTab === "forum" ? "active" : ""} onClick={() => setActiveTab("forum")}><CircleHelp size={15} /> Forum</button>
        <label><Search size={15} /><input placeholder="Search" /></label>
      </nav>
      {activeTab !== "home" && (
        <div className="title-band">
          <div>
            <h1>{tabDetails[activeTab]?.title}</h1>
            <span>{tabDetails[activeTab]?.subtitle}</span>
          </div>
        </div>
      )}
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
            <option>All</option>{statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <button title="Sort"><SlidersHorizontal size={15} /></button>
        <button title="More options"><MoreHorizontal size={16} /></button>
      </div>
    </div>
  );
}

function TicketBoard({ rows, selected, onSelect }: { rows: Ticket[]; selected: Ticket; onSelect: (ticket: Ticket) => void }) {
  return (
    <div className="kanban-board">
      {statuses.map((ticketStatus) => {
        const statusRows = rows.filter((ticket) => ticket.status === ticketStatus);
        return (
          <section className="kanban-lane" key={ticketStatus}>
            <header><span><i className={statusClass[ticketStatus]} />{ticketStatus}</span><strong>{statusRows.length}</strong></header>
            <div className="kanban-cards">
              {statusRows.map((ticket) => (
                <button key={ticket.number} className={`kanban-ticket ${selected.number === ticket.number ? "selected" : ""}`} onClick={() => onSelect(ticket)}>
                  <span className="kanban-ticket-meta">#{ticket.number} <Tag className={`type ${typeClass[ticket.type]}`}>{ticket.type}</Tag></span>
                  <strong>{ticket.title}</strong>
                  <span className="kanban-location"><MapPin size={12} />{ticket.location}</span>
                  <span className="kanban-owner">{ticket.owner}</span>
                </button>
              ))}
              {!statusRows.length && <p className="kanban-empty">No tickets in this stage.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TicketRoadmap({ rows, selected, onSelect, onOpenCalendar }: { rows: Ticket[]; selected: Ticket; onSelect: (ticket: Ticket) => void; onOpenCalendar: () => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const referenceDate = new Date(2026, 8, 30);
  const referenceSunday = new Date(referenceDate);
  referenceSunday.setDate(referenceDate.getDate() - referenceDate.getDay() + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(referenceSunday);
    date.setDate(referenceSunday.getDate() + index);
    return date;
  });
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthLabel = days[3].toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const ticketDay = (ticket: Ticket) => {
    const [month, day] = ticket.created.split(" ");
    const monthNumber = new Date(`${month} 1, 2026`).getMonth();
    return new Date(2026, monthNumber, Number(day));
  };
  const ticketDayIndex = (ticket: Ticket) => days.findIndex((date) => date.toDateString() === ticketDay(ticket).toDateString());

  return (
    <section className="ticket-roadmap" aria-label="Ticket calendar roadmap">
      <header className="roadmap-toolbar">
        <h2>{monthLabel}</h2>
        <div className="roadmap-calendar-actions">
          <button className="roadmap-manage" onClick={onOpenCalendar}><CalendarDays size={13} /> Manage in Calendar</button>
          <span className="roadmap-view-label">Week</span>
          <button className="roadmap-arrow" aria-label="Previous week" onClick={() => setWeekOffset((offset) => offset - 1)}><ChevronLeft size={15} /></button>
          <button className="roadmap-today" onClick={() => setWeekOffset(0)}>Today</button>
          <button className="roadmap-arrow" aria-label="Next week" onClick={() => setWeekOffset((offset) => offset + 1)}><ChevronRight size={15} /></button>
        </div>
      </header>
      <div className="roadmap-calendar-scroll">
        <div className="roadmap-calendar-grid" style={{ "--roadmap-days": days.length } as CSSProperties}>
          <div className="roadmap-calendar-header">
            <div className="roadmap-corner">Tickets</div>
            {days.map((date, index) => (
              <div className="roadmap-day-heading" key={date.toISOString()}>
                <span>{weekdays[index]}</span><strong>{date.getDate()}</strong>
              </div>
            ))}
          </div>
          {rows.map((ticket) => {
            const dateIndex = ticketDayIndex(ticket);
            return (
              <div className="roadmap-calendar-row" key={ticket.number}>
                <button className={`roadmap-row-label ${selected.number === ticket.number ? "selected" : ""}`} onClick={() => onSelect(ticket)}>
                  <span className="roadmap-row-number">{ticket.number}</span>
                  <span className="roadmap-row-copy"><strong>{ticket.title}</strong><small>{ticket.status} · {ticket.created}</small></span>
                </button>
                {days.map((date, index) => <div className={`roadmap-day-cell ${index % 2 ? "alternate" : ""}`} key={`${ticket.number}-${date.toISOString()}`} />)}
                {dateIndex >= 0 && (
                  <button
                    className={`roadmap-event ${statusClass[ticket.status]} ${selected.number === ticket.number ? "selected" : ""}`}
                    style={{ "--event-day": dateIndex } as CSSProperties}
                    onClick={() => onSelect(ticket)}
                    title={`${ticket.title} · Created ${ticket.created}`}
                  >
                    <span>{ticket.title}</span>
                    <Tag className={`status ${statusClass[ticket.status]}`}>{ticket.status}</Tag>
                  </button>
                )}
              </div>
            );
          })}
          {!rows.length && <div className="roadmap-no-results">No tickets match the current filters.</div>}
        </div>
      </div>
    </section>
  );
}

function MapView({ tickets, selected, onSelect }: { tickets: Ticket[]; selected: Ticket; onSelect: (ticket: Ticket) => void }) {
  const mapped = tickets.filter((ticket) => ticket.coordinates);
  const pinPositions = mapped.map((ticket) => {
    const [lat, lng] = ticket.coordinates!;
    return { ...ticket, ...projectMapCoordinates(lat, lng) };
  });
  const markerIndex = mapped.findIndex((item) => item.id === selected.id);

  return (
    <div className="map-view">
      <div className="map-canvas">
        <div className="map-embed-shell">
          <iframe
            title="NYC Boundaries map"
            src="https://boundaries.beta.nyc/?map=cd&dist=103"
            className="map-embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="map-pin-layer">
          {pinPositions.map((ticket, index) => (
            <button
              key={ticket.id}
              className={`map-pin ${selected.id === ticket.id ? "active" : ""}`}
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
        <span className="marker-number">{markerIndex >= 0 ? markerIndex + 1 : "–"}</span>
        <div><strong>{selected.title}</strong><p><MapPin size={11} /> {selected.location}</p></div>
        <Tag className={`status ${statusClass[selected.status]}`}>{selected.status}</Tag>
      </div>
    </div>
  );
}

function SummaryView({ rows }: { rows: Ticket[] }) {
  const statusCounts = statuses.map((status) => ({
    status,
    count: rows.filter((ticket) => ticket.status === status).length,
  }));
  const types = ticketTypes.map((type) => ({
    type,
    count: rows.filter((ticket) => ticket.type === type).length,
  })).filter((item) => item.count);
  const maxType = Math.max(...types.map((item) => item.count), 1);
  return (
    <div className="summary-view">
      <div className="summary-heading"><div><h2>Ticket overview</h2><p>Dashboard for the current left-hand view</p></div></div>
      <div className="metric-row">
        <article><span>VISIBLE TICKETS</span><strong>{rows.length}</strong><small>Current filtered view</small></article>
        <article><span>IN PROGRESS</span><strong>{statusCounts.find((item) => item.status === "In Progress")?.count || 0}</strong><small>Need staff follow-up</small></article>
        <article><span>CLOSED</span><strong>{statusCounts.find((item) => item.status === "Closed")?.count || 0}</strong><small>This reporting period</small></article>
      </div>
      <section className="summary-card">
        <div className="card-heading"><h3>Status</h3><span>{rows.length} total</span></div>
        <div className="donut-layout">
          <div className="donut" style={{
            background: `conic-gradient(#e5a419 0 ${(statusCounts[0].count / Math.max(rows.length, 1)) * 100}%, #2a93c9 0 ${((statusCounts[0].count + statusCounts[1].count) / Math.max(rows.length, 1)) * 100}%, #2d9b65 0)`,
          }}><span><strong>{rows.length}</strong>tickets</span></div>
          <div className="status-legend">{statusCounts.map((item) => <div key={item.status}><i className={statusClass[item.status]} /><span>{item.status}</span><strong>{item.count}</strong></div>)}</div>
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

function HomeView({ setActiveTab, onSearch }: { setActiveTab: (tab: TabName) => void; onSearch: (query: string) => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const actions: Array<{ label: string; icon: typeof Search; tab: TabName }> = [
    { label: "Review Meeting Transcript", icon: ScrollText, tab: "tickets" },
    { label: "Look Up Tickets", icon: Search, tab: "tickets" },
    { label: "Find Document Templates", icon: FileText, tab: "templates" },
  ];

  return (
    <main className="home-view">
      <div className="hero-banner" aria-label="Home page banner">
        <div className="hero-content">
          <div className="hero-primary">
            <div className="hero-copy">
              <h1>hey cb3 👋,<br />how can we<br />help you?</h1>
            </div>
            <form className="hero-search" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(searchTerm.trim()); }}>
              <input aria-label="Search tickets" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="I want to..." />
              <button aria-label="Search" type="submit"><Search size={24} strokeWidth={3} /></button>
            </form>
          </div>
          <div className="hero-actions">
            {actions.map(({ label, icon: Icon, tab }, index) => (
              <button key={label} className={index === 0 ? "primary" : ""} onClick={() => setActiveTab(tab)}>
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

function OutreachView({ setActiveTab }: { setActiveTab: (tab: TabName) => void }) {
  const [selected, setSelected] = useState(outreachEntries[0]);
  const [channel, setChannel] = useState<OutreachChannel>("Instagram");
  const [enabledChannels, setEnabledChannels] = useState<Record<string, OutreachChannel[]>>(() => Object.fromEntries(outreachEntries.map((entry) => [entry.number, [...outreachChannels]])));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [posted, setPosted] = useState<Record<string, boolean>>({});
  const selectedChannels = enabledChannels[selected.number] ?? outreachChannels;
  const draftKey = `${selected.number}:${channel}`;
  const currentDraft = drafts[draftKey] ?? defaultOutreachCopy(channel, selected);
  const primaryMedia = selected.attachments[0];

  const updateDraft = (value: string) => setDrafts((current) => ({ ...current, [draftKey]: value }));
  const selectEntry = (entry: OutreachEntry) => {
    setSelected(entry);
    const available = enabledChannels[entry.number] ?? outreachChannels;
    if (available.length && !available.includes(channel)) setChannel(available[0]);
  };
  const toggleChannel = (event: React.MouseEvent<HTMLButtonElement>, entry: OutreachEntry, target: OutreachChannel) => {
    event.stopPropagation();
    const current = enabledChannels[entry.number] ?? [...outreachChannels];
    const next = current.includes(target) ? current.filter((item) => item !== target) : [...current, target];
    setEnabledChannels((existing) => ({ ...existing, [entry.number]: next }));
    setSelected(entry);
    if (entry.number === selected.number && !next.includes(channel)) setChannel(next[0] ?? target);
  };

  return (
    <div className="portal">
      <PortalHeader activeTab="outreach" setActiveTab={setActiveTab} />
      <main className="outreach-workspace">
        <section className="outreach-records">
          <div className="outreach-toolbar">
            <div><strong>Community wins</strong><span>{outreachEntries.length} records</span></div>
          </div>
          <div className="outreach-table-scroll">
            <table className="outreach-table">
              <thead><tr><th>Outreach #</th><th>Title</th><th>Type</th><th>Status</th><th>Source</th><th>Supporting attachments</th><th>Channels</th></tr></thead>
              <tbody>
                {outreachEntries.map((entry) => (
                    <tr key={entry.number} className={selected.number === entry.number ? "selected" : ""} onClick={() => selectEntry(entry)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectEntry(entry); }}>
                    <td className="outreach-number">{entry.number}</td>
                    <td className="outreach-title-cell">{entry.title}</td>
                    <td><span className={`outreach-type ${entry.type === "Resolution" ? "resolution" : "event"}`}>{entry.type}</span></td>
                    <td><span className={`outreach-status ${entry.status.toLowerCase()}`}><i />{entry.status}</span></td>
                    <td className="outreach-source">{entry.source}</td>
                    <td>
                      <div className="outreach-attachments">
                        {entry.attachments.map((attachment) => (
                          <span key={attachment.name} className="outreach-attachment" title={attachment.name}>
                            <span className="outreach-attachment-thumb"><img src="/cb3_hero.jpg" alt="" />{attachment.kind === "Video" ? <Play size={12} fill="currentColor" /> : <ImageIcon size={12} />}</span>
                            <span>{attachment.name}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="outreach-row-channels" aria-label={`Channels for outreach ${entry.number}`}>
                        {outreachChannels.map((item) => {
                          const iconData = item === "Newsletter" ? undefined : outreachChannelIconData[item as keyof typeof outreachChannelIconData];
                          const isEnabled = (enabledChannels[entry.number] ?? outreachChannels).includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              className={`outreach-channel-toggle ${item.toLowerCase()} ${isEnabled ? "enabled" : ""}`}
                              aria-label={`${isEnabled ? "Disable" : "Enable"} ${item} for outreach ${entry.number}`}
                              aria-pressed={isEnabled}
                              title={`${item}: ${isEnabled ? "included" : "not included"}`}
                              onClick={(event) => toggleChannel(event, entry, item)}
                            >
                              <OutreachChannelIcon channel={item} />
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="outreach-composer" aria-label="Social media post composer">
          <div className="outreach-channel-tabs" role="tablist" aria-label="Social channels">
            {outreachChannels.map((item) => {
              const enabled = selectedChannels.includes(item);
              return (
                <button key={item} role="tab" aria-selected={channel === item} aria-disabled={!enabled} disabled={!enabled} className={`${channel === item ? `active ${item.toLowerCase()}` : ""} ${enabled ? "enabled" : "disabled"}`} onClick={() => setChannel(item)}>
                  <OutreachChannelIcon channel={item} /><span>{item}</span>
                </button>
              );
            })}
          </div>
          {!selectedChannels.length && <div className="outreach-no-channels"><Mail size={22} /><strong>No channels selected</strong><span>Turn on at least one channel in this outreach row to prepare a post.</span></div>}
          <div className="outreach-preview-heading" hidden={!selectedChannels.length}><div><h2>{channel} preview</h2><span>Editable draft · preview only</span></div><span className="outreach-preview-record">#{selected.number}</span></div>
          <div className={`social-preview ${channel.toLowerCase()}`} hidden={!selectedChannels.length}>
            {(channel === "Instagram" || channel === "Facebook") && <div className="social-preview-account"><span className="social-avatar">CB3</span><span><strong>Manhattan Community Board 3</strong><small>{channel === "Instagram" ? "manhattancb3" : "Community organization"}</small></span><button type="button" aria-label="More post options">···</button></div>}
            {channel === "X" && <div className="social-preview-account"><span className="social-avatar">CB3</span><span><strong>Manhattan CB3</strong><small>@ManhattanCB3 · now</small></span><button type="button" aria-label="More post options">···</button></div>}
            {(channel === "Instagram" || channel === "Facebook") && <div className="social-preview-image"><img src="/cb3_hero.jpg" alt="Preview of the attached CB3 community image" />{primaryMedia.kind === "Video" && <span className="social-video-play"><Play size={20} fill="currentColor" /></span>}</div>}
            {channel === "Blog" && <div className="social-preview-image blog-image"><img src="/cb3_hero.jpg" alt="Preview of the attached CB3 community image" /></div>}
            {channel === "Newsletter" && <div className="newsletter-brand"><span>MANHATTAN COMMUNITY BOARD 3</span><strong>District Notes</strong><small>Community updates and ways to take part</small></div>}
            <div className="social-preview-copy">
              {(channel === "Blog" || channel === "Newsletter") && <strong className="social-preview-title">{selected.title}</strong>}
              {(channel === "Instagram" || channel === "Facebook") && <strong className="social-preview-profile">{channel === "Instagram" ? "manhattancb3" : "Manhattan Community Board 3"}</strong>}
              <textarea className="social-preview-editor" aria-label={`${channel} post text`} value={currentDraft} onChange={(event) => updateDraft(event.target.value)} />
              {channel === "X" && <small>manhattancb3.gov · {selected.source}</small>}
            </div>
            {(channel === "Facebook" || channel === "Blog" || channel === "Newsletter") && <div className="social-preview-link"><span>{channel === "Facebook" ? "MANHATTANCB3" : "MANHATTANCB3.ORG"}</span><strong>{selected.title}</strong><small>{selected.source}</small></div>}
            <div className="social-preview-actions"><span>{channel === "Instagram" ? "♡　◯　➤" : channel === "X" ? "◯　↻　♡" : "Like　·　Comment　·　Share"}</span><small>Sample platform preview</small></div>
          </div>
          <div className="outreach-compose-footer" hidden={!selectedChannels.length}>
            <span>{currentDraft.length} characters</span>
            <button className={posted[draftKey] ? "posted" : ""} type="button" onClick={() => setPosted((current) => ({ ...current, [draftKey]: true }))}>
              {posted[draftKey] ? <><Check size={15} /> Posted</> : <><Send size={14} /> Post</>}
            </button>
          </div>
        </section>
      </main>
      <PortalFooter />
    </div>
  );
}

function CalendarView({ setActiveTab }: { setActiveTab: (tab: TabName) => void }) {
  const monthLabel = "October 2026";
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysInMonth = 31;
  const firstWeekday = 4;
  const cells = Array.from({ length: 35 }, (_, index) => {
    const dayNumber = index - firstWeekday + 1;
    const isoDate = dayNumber >= 1 && dayNumber <= daysInMonth ? `2026-10-${String(dayNumber).padStart(2, "0")}` : "";
    const dayEvents = calendarEvents.filter((event) => event.date === isoDate);

    return {
      dayNumber,
      isoDate,
      dayEvents,
    };
  });

  return (
    <div className="portal">
      <PortalHeader activeTab="calendar" setActiveTab={setActiveTab} />
      <main className="calendar-view">
        <section className="calendar-shell">
          <div className="calendar-header">
            <div>
              <h1>{monthLabel}</h1>
            </div>
            <button className="primary-action">Add event</button>
          </div>

          <div className="calendar-layout">
            <div className="calendar-grid-wrap">
              <div className="calendar-grid-header">
                {weekDays.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="calendar-grid">
                {cells.map(({ dayNumber, isoDate, dayEvents }, index) => (
                  <div key={`${isoDate || "empty"}-${index}`} className={`calendar-cell ${dayNumber < 1 || dayNumber > daysInMonth ? "muted" : ""}`}>
                    <span className="date-number">{dayNumber > 0 && dayNumber <= daysInMonth ? dayNumber : ""}</span>
                    {dayEvents.map((event) => (
                      <button key={event.date + event.title} className="calendar-event" type="button">
                        <strong>{event.title}</strong>
                        <span>{event.time}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <aside className="calendar-side-panel">
              <h2>Upcoming meetings</h2>
              {calendarEvents.map((event) => (
                <article key={event.date} className="calendar-event-card">
                  <span className="event-date">{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <h3>{event.title}</h3>
                  <p><CalendarDays size={13} /> {event.time}</p>
                  <p><MapPin size={13} /> {event.location}</p>
                  <small>{event.description}</small>
                </article>
              ))}
            </aside>
          </div>
        </section>
      </main>
      <PortalFooter />
    </div>
  );
}

function TemplatesView({ setActiveTab }: { setActiveTab: (tab: TabName) => void }) {
  const templates = [
    { name: "Blank document", kind: "Blank" },
    { name: "Letter", kind: "Letter" },
    { name: "Resolution", kind: "Resolution" },
    { name: "Capital request", kind: "Capital" },
    { name: "District needs", kind: "Needs" },
    { name: "Statement", kind: "Statement" },
  ];

  const recentDocuments = [
    { name: "East Village hearing notes", date: "Opened 1 day ago" },
    { name: "Budget memo", date: "Opened 2 days ago" },
    { name: "Capital request draft", date: "Opened 3 days ago" },
    { name: "Letter to DOT", date: "Opened 4 days ago" },
  ];

  return (
    <div className="portal">
      <PortalHeader activeTab="templates" setActiveTab={setActiveTab} />
      <main className="templates-view">
        <section className="templates-shell">
          <div className="templates-header-row">
            <h1>Start a document</h1>
            <div className="templates-header-actions">
              <button className="ghost-button">Template gallery</button>
              <button className="icon-button" aria-label="More options">⋮</button>
            </div>
          </div>

          <div className="template-grid">
            {templates.map((template) => (
              <article key={template.name} className="template-card">
                <div className="template-preview preview-blank">
                  <div className="doc-corner" />
                  <div className="doc-lines" />
                </div>
                <h3>{template.name}</h3>
              </article>
            ))}
          </div>

          <div className="recent-documents-header">
            <h2>Recent documents</h2>
            <div className="recent-actions">
              <button className="ghost-button small">Owned by anyone</button>
              <button className="icon-button" aria-label="List view">☰</button>
            </div>
          </div>

          <div className="recent-grid">
            {recentDocuments.map((document) => (
              <article key={document.name} className="recent-card">
                <div className="recent-preview">
                  <div className="mini-doc" />
                </div>
                <h3>{document.name}</h3>
                <p>{document.date}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <PortalFooter />
    </div>
  );
}

function ForumView({ setActiveTab }: { setActiveTab: (tab: TabName) => void }) {
  const links = [
    { name: "District Page", url: "https://www.nyc.gov/site/manhattancommunityboards/boards/cd03.page", description: "District updates and public notices." },
    { name: "NYC 311", url: "https://portal.311.nyc.gov/", description: "Service requests and city complaint tracking." },
    { name: "NYC Planning", url: "https://www.nyc.gov/site/planning/index.page", description: "Land use, zoning, and planning resources." },
    { name: "YouTube", url: "https://www.youtube.com/", description: "Meeting recordings and board updates." },
  ];
  const [posts, setPosts] = useState([
    {
      id: "forum-1",
      title: "How are boards organizing language access at public meetings?",
      body: "We are updating our meeting process and would love to hear how other boards arrange interpretation and translated materials.",
      category: "Meeting operations",
      author: "Jordan Lee",
      board: "Manhattan CB3",
      date: "Today",
      replies: [
        { author: "Maya Chen", board: "Queens CB2", text: "We include an interpretation request on registration and confirm languages with speakers a few days ahead." },
        { author: "Sam Rivera", board: "Brooklyn CB6", text: "Our district office keeps a shared vendor list so committees can coordinate availability." },
      ],
    },
    {
      id: "forum-2",
      title: "What is your process for tracking agency follow-ups after a hearing?",
      body: "Looking for a lightweight way to keep commitments visible between committee meetings without creating duplicate records.",
      category: "Best practices",
      author: "Avery Johnson",
      board: "Bronx CB4",
      date: "Yesterday",
      replies: [
        { author: "Taylor Morgan", board: "Manhattan CB1", text: "We assign one owner and a due date in the committee notes, then review open items at the next meeting." },
      ],
    },
    {
      id: "forum-3",
      title: "Sharing neighborhood cleanup outreach that works",
      body: "Which channels have helped you reach residents who do not already follow board newsletters or social accounts?",
      category: "Outreach",
      author: "Nia Patel",
      board: "Staten Island CB1",
      date: "2 days ago",
      replies: [],
    },
  ]);
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionBody, setQuestionBody] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const submitQuestion = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = questionTitle.trim();
    const body = questionBody.trim();
    if (!title || !body) return;
    setPosts((current) => [{
      id: `forum-${Date.now()}`,
      title,
      body,
      category: "Community question",
      author: "You",
      board: "Manhattan CB3",
      date: "Just now",
      replies: [],
    }, ...current]);
    setQuestionTitle("");
    setQuestionBody("");
  };

  const submitReply = (event: React.FormEvent<HTMLFormElement>, postId: string) => {
    event.preventDefault();
    const text = replyDrafts[postId]?.trim();
    if (!text) return;
    setPosts((current) => current.map((post) => post.id === postId ? {
      ...post,
      replies: [...post.replies, { author: "You", board: "Manhattan CB3", text }],
    } : post));
    setReplyDrafts((current) => ({ ...current, [postId]: "" }));
  };

  return (
    <div className="portal">
      <PortalHeader activeTab="forum" setActiveTab={setActiveTab} />
      <main className="forum-view">
        <aside className="forum-resources">
          <h2>Resources</h2>
          <p>Useful links for board members</p>
          <div className="resource-links">
            {links.map((link) => (
              <a key={link.name} href={link.url} target="_blank" rel="noreferrer">
                <strong>{link.name}</strong>
                <span>{link.description}</span>
              </a>
            ))}
          </div>
        </aside>
        <section className="forum-main">
          <header className="forum-heading">
            <div><span className="forum-eyebrow"><MessageCircle size={14} /> BOARD-TO-BOARD EXCHANGE</span><h2>Community forum</h2></div>
            <span className="forum-member-count"><Users size={14} /> Community boards</span>
          </header>
          <form className="forum-compose" onSubmit={submitQuestion}>
            <div className="compose-avatar">CB3</div>
            <div className="compose-fields">
              <input aria-label="Question title" value={questionTitle} onChange={(event) => setQuestionTitle(event.target.value)} placeholder="What would you like to ask other boards?" required />
              <textarea aria-label="Question details" value={questionBody} onChange={(event) => setQuestionBody(event.target.value)} placeholder="Add context, what you have tried, or what kind of advice would help..." required />
              <div className="compose-footer"><span>Posting as Manhattan CB3</span><button type="submit"><Send size={14} /> Post question</button></div>
            </div>
          </form>
          <div className="forum-feed-heading"><h3>Recent discussions</h3><span>{posts.length} discussions</span></div>
          <div className="forum-feed">
            {posts.map((post) => (
              <article className="forum-post" key={post.id}>
                <div className="post-avatar">{post.board.split(" ").slice(-1)[0].slice(0, 2).toUpperCase()}</div>
                <div className="post-content">
                  <div className="post-meta"><strong>{post.author}</strong><span>{post.board}</span><i>·</i><time>{post.date}</time><Tag className="forum-category">{post.category}</Tag></div>
                  <h3>{post.title}</h3>
                  <p>{post.body}</p>
                  {post.replies.length > 0 && <div className="post-replies">
                    {post.replies.map((reply, index) => (
                      <div className="forum-reply" key={`${post.id}-reply-${index}`}>
                        <div className="reply-avatar">{reply.board.split(" ").slice(-1)[0].slice(0, 2).toUpperCase()}</div>
                        <div><strong>{reply.author} <span>{reply.board}</span></strong><p>{reply.text}</p></div>
                      </div>
                    ))}
                  </div>}
                  <form className="reply-form" onSubmit={(event) => submitReply(event, post.id)}>
                    <input aria-label={`Reply to ${post.title}`} value={replyDrafts[post.id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Write a reply..." required />
                    <button type="submit" aria-label="Send reply"><Send size={15} /></button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <PortalFooter />
    </div>
  );
}

export default function App() {
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedId, setSelectedId] = useState(initialTickets[0].id);
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Status>("All");
  const [sideTab, setSideTab] = useState<"transcript" | "map" | "summary">("transcript");
  const [hover, setHover] = useState<{ id: string | null; from: "table" | "transcript" }>({ id: null, from: "table" });
  const [jump, setJump] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  const [ticketView, setTicketView] = useState<TicketView>("list");
  const [activeTab, setActiveTab] = useState<TabName>("home");

  const rows = useMemo(() => tickets.filter((ticket) => {
    const matchesStatus = status === "All" || ticket.status === status;
    const search = query.toLowerCase();
    const matchesQuery = !search || `${ticket.number} ${ticket.title} ${ticket.type} ${ticket.location} ${ticket.requester} ${ticket.summary}`.toLowerCase().includes(search);
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

  const searchTicketsFromHome = (value: string) => {
    setQuery(value);
    setStatus("All");
    setActiveTab("tickets");
  };

  if (activeTab === "home") {
    return (
      <div className="portal">
        <PortalHeader activeTab={activeTab} setActiveTab={setActiveTab} />
        <HomeView setActiveTab={setActiveTab} onSearch={searchTicketsFromHome} />
        <PortalFooter />
      </div>
    );
  }

  if (activeTab === "templates") {
    return <TemplatesView setActiveTab={setActiveTab} />;
  }

  if (activeTab === "forum") {
    return <ForumView setActiveTab={setActiveTab} />;
  }

  if (activeTab === "calendar") {
    return <CalendarView setActiveTab={setActiveTab} />;
  }

  if (activeTab === "outreach") {
    return <OutreachView setActiveTab={setActiveTab} />;
  }

  return (
    <div className="portal">
      <PortalHeader activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className={ticketView === "list" ? "workspace" : "workspace ticket-full-view"}>
        <section className="records-pane">
          <Toolbar query={query} setQuery={setQuery} status={status} setStatus={setStatus} />
          <div className="ticket-subnav" role="tablist" aria-label="Ticket views">
            {(["list", "kanban", "roadmap"] as TicketView[]).map((view) => (
              <button key={view} role="tab" aria-selected={ticketView === view} className={ticketView === view ? "active" : ""} onClick={() => setTicketView(view)}>
                {view === "list" ? "List" : view === "kanban" ? "Kanban board" : "Roadmap"}
              </button>
            ))}
            <strong>{rows.length} tickets</strong>
            <button className="ticket-add"><Plus size={14} /> Add ticket</button>
          </div>
          {ticketView === "list" && <TicketTable rows={rows} selectedId={selected.id} hoveredId={hover.id} followHover={hover.from === "transcript"} onHover={(id) => setHover({ id, from: "table" })} onSelect={selectTicket} onChange={updateTicket} />}
          {ticketView === "kanban" && <TicketBoard rows={rows} selected={selected} onSelect={selectTicket} />}
          {ticketView === "roadmap" && <TicketRoadmap rows={rows} selected={selected} onSelect={selectTicket} onOpenCalendar={() => setActiveTab("calendar")} />}
        </section>
        {ticketView === "list" && <aside className="insights-pane">
          <div className="insights-tabs">
            <button className={sideTab === "transcript" ? "active" : ""} onClick={() => setSideTab("transcript")}><ScrollText size={15} /> Transcript</button>
            <button className={sideTab === "map" ? "active" : ""} onClick={() => setSideTab("map")}><Map size={15} /> Map</button>
            <button className={sideTab === "summary" ? "active" : ""} onClick={() => setSideTab("summary")}><BarChart3 size={15} /> Summary</button>
          </div>
          {sideTab === "transcript" && <TranscriptView tickets={tickets} hoveredId={hover.id} onHover={onTranscriptHover} onSpanChange={updateSpan} jump={jump} />}
          {sideTab === "map" && <MapView tickets={tickets} selected={selected} onSelect={selectTicket} />}
          {sideTab === "summary" && <SummaryView rows={rows} />}
        </aside>}
      </main>
      <PortalFooter />
    </div>
  );
}
