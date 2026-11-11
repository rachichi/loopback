// The public landing page (part 1: local only, reached at /landing). A header, a hero on the app's blue band, a
// clickable demo of the Meetings tab built from the app's own components, the resident share page, the phone
// intake form and a closing call to action. Everything is fake and lives in this page's state: no database
// calls, no sign-in, nothing saved. Loaded with React.lazy from App.tsx so none of it reaches the entry chunk.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BatteryFull, CalendarDays, ChevronDown, ChevronRight, ClipboardList, FileText, House, Link2, ListChecks, MapPin, NotebookText, Plus, Search, Signal, Sparkles, Wifi } from "lucide-react";
import loopbackLogo from "../../assets/logo.png";
import Logo from "../../Logo";
import { trackEvent, trackPage } from "../../lib/analytics";
import MapView from "../../MapView";
import TicketTable from "../../TicketTable";
import TranscriptView from "../../TranscriptView";
import { inTab, UrgencyTabs, type UrgencyTab } from "../../TicketFilters";
import { StaticBoardProvider, useBoard, useTypeClass } from "../../lib/board";
import { statusClass, today, type Ticket } from "../tickets/types";
import timesSquare from "./assets/bg-times-square.jpg";
import bridge from "./assets/bg-bridge.jpg";
import mural from "./assets/bg-mural.jpg";
import watercolor from "./assets/bg-watercolor.png";
import { demoBoard } from "./demoBoard";
import { DEMO_MEETING_ID, demoMeeting, demoMinutes, demoTickets } from "./demoData";
import IntakeModal from "./IntakeModal";
import "./landing.css";

/** Where Sign in goes. On the single Netlify site that is the site's own root, which shows the sign-in screen to
 *  anyone logged out. Once the domains exist, set VITE_APP_URL to the app's address (for example https://app.<domain>). */
const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? window.location.origin;

/** A blurred photo behind a window, like the Cursor page. The photo is blurred, not the window on top of it. */
function Backdrop({ image, className = "", children }: { image: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`lp-backdrop ${className}`} style={{ "--lp-bg": `url(${image})` } as React.CSSProperties}>
      <div className="lp-backdrop-scroll">{children}</div>
    </div>
  );
}

/** On a phone the demo is laid out at laptop width, then shrunk with CSS zoom to fit the page. With `cropLeft`, it is
 *  zoomed in further and the left side is cut off, so the right of the window (the Generate button, tickets and minutes)
 *  fills the screen. Small is fine. */
function FitWidth({ natural, show, maxHeight, anchor = "right", children }: { natural: number; show?: number; maxHeight?: number; anchor?: "left" | "right"; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ zoom: 1, shift: 0 });
  const scrolled = useRef(false);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) + parseFloat(getComputedStyle(el).paddingRight);
    const update = () => {
      if (window.innerWidth > 900) return setFit({ zoom: 1, shift: 0 });
      const width = el.clientWidth - pad;
      const zoom = Math.min(1, width / (show ?? natural));
      setFit({ zoom, shift: 0 });
      // The window is scrollable sideways: start at the edge the old crop showed.
      const scroller = el.querySelector<HTMLElement>(".lp-backdrop-scroll") ?? (el.classList.contains("lp-backdrop-scroll") ? el : null);
      if (scroller && !scrolled.current) {
        scrolled.current = true;
        requestAnimationFrame(() => { scroller.scrollLeft = show && anchor === "right" ? scroller.scrollWidth : 0; });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [natural, show, anchor]);
  const style = fit.zoom < 1 ? ({ zoom: fit.zoom, marginLeft: -fit.shift } as React.CSSProperties) : undefined;
  return <div ref={ref} className="lp-fit-crop" style={fit.zoom < 1 && maxHeight ? { maxHeight } : undefined}><div className="lp-fit" style={style}>{children}</div></div>;
}

const meetingList = [{ id: DEMO_MEETING_ID, title: demoMeeting.title }];
const noop = () => {};

export default function Landing() {
  const [intakeOpen, setIntakeOpen] = useState(false);
  // The demo's tickets. Edits and the phone form change this copy only, and a reload starts over.
  const [tickets, setTickets] = useState<Ticket[]>(demoTickets);
  useEffect(() => { trackPage("/landing", "Landing"); }, []);
  // `source` names the button, so the events show which one visitors use.
  const open = (source: string) => { trackEvent("landing_cta_clicked", { source }); setIntakeOpen(true); };

  return (
    <div className="lp">
      <header className="lp-header">
        <a className="lp-brand" href="/landing" aria-label="Loopback">
          <img src={loopbackLogo} alt="" />
          <span>Loopback</span>
        </a>
        <nav className="lp-nav">
          <a href="/landing/about">About</a>
          <a className="lp-signin" href={APP_URL} onClick={() => trackEvent("landing_signin_clicked")}>Sign in</a>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-inner">
          <h1>Loopback is the tool for community boards.</h1>
          <button type="button" className="lp-cta" onClick={() => open("hero")}>Get Loopback for your board <ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </section>

      <StaticBoardProvider board={demoBoard}>
        <div className="lp-stage">
          <Backdrop image={watercolor} className="lp-hero-backdrop"><FitWidth natural={1280} show={760}><DemoApp tickets={tickets} setTickets={setTickets} /></FitWidth></Backdrop>
        </div>

        <section className="lp-feature">
          <div className="lp-feature-text">
            <h2>View link for residents</h2>
            <p>Share progress on requests to residents.</p>
          </div>
          <Backdrop image={timesSquare} className="lp-feature-visual lp-share-backdrop"><FitWidth natural={1280} show={860} anchor="left"><SharePage tickets={tickets} /></FitWidth></Backdrop>
        </section>

        <section id="lp-mobile" className="lp-feature lp-feature-phone">
          <div className="lp-feature-text">
            <h2>Mobile intake form</h2>
            <p>Send in tickets on the move.</p>
          </div>
          <Backdrop image={bridge} className="lp-feature-visual"><PhoneForm onSubmit={(ticket) => setTickets((current) => [...current, { ...ticket, number: String(current.length + 1) }])} /></Backdrop>
        </section>
      </StaticBoardProvider>

      <section className="lp-closing">
        <h2>Try Loopback now.</h2>
        <button type="button" className="lp-cta" onClick={() => open("closing")}>Get Loopback for your board <ChevronRight size={18} aria-hidden="true" /></button>
      </section>

      {/* The app's footer, with Contact us opening the same popup as the buttons. */}
      <footer className="portal-footer">
        <div className="portal-footer-inner">
          <img src={loopbackLogo} alt="Loopback" />
          <div className="portal-footer-contact">
            <p>Loopback for community boards.</p>
            <p>The Loopback portal was launched in 2026 by community members<br />to empower the community boards that serve them.</p>
            <p><button type="button" className="lp-footer-link" onClick={() => open("footer")}>Contact us</button> for questions, feedback, or feature requests.</p>
          </div>
        </div>
      </footer>

      {intakeOpen && <IntakeModal onClose={() => setIntakeOpen(false)} />}
    </div>
  );
}

/** A window frame like the Cursor page's: three dots and a title over whatever it holds. */
function Window({ title, className = "", onPointerDown, children }: { title: string; className?: string; onPointerDown?: () => void; children: React.ReactNode }) {
  return (
    <div className={`lp-window ${className}`} onPointerDown={onPointerDown}>
      <div className="lp-window-bar" aria-hidden="true"><i /><i /><i /><span>{title}</span></div>
      {children}
    </div>
  );
}

/** The signed-in app: a Tickets tab and the Meetings tab, which opens already generated with all three columns. */
function DemoApp({ tickets, setTickets }: { tickets: Ticket[]; setTickets: React.Dispatch<React.SetStateAction<Ticket[]>> }) {
  const typeClass = useTypeClass();
  const [tab, setTabState] = useState<"home" | "tickets" | "meetings">("meetings");
  const setTab = (next: typeof tab) => { if (next !== tab) trackEvent("landing_demo_tab", { tab: next }); setTabState(next); };
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [jump, setJump] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  const [urgency, setUrgency] = useState<UrgencyTab>("all");

  // On load the Meetings tab plays as if Generate was just pressed: the button fills for a couple of seconds, then the
  // tickets, their highlights in the transcript and the minutes appear.
  const [progress, setProgress] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const total = useRef(tickets.filter((ticket) => ticket.meetingIds.includes(DEMO_MEETING_ID)).length).current;
  const generating = progress < 1;
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setProgress(1); setRevealed(total); return; }
    const started = Date.now();
    const fill = window.setInterval(() => {
      const next = Math.min(1, (Date.now() - started) / 2200);
      setProgress(next);
      if (next >= 1) window.clearInterval(fill);
    }, 80);
    return () => window.clearInterval(fill);
  }, [total]);
  useEffect(() => {
    if (generating) return;
    const reveal = window.setInterval(() => setRevealed((count) => { if (count + 1 >= total) window.clearInterval(reveal); return Math.min(total, count + 1); }), 380);
    return () => window.clearInterval(reveal);
  }, [generating, total]);

  const allInMeeting = tickets.filter((ticket) => ticket.meetingIds.includes(DEMO_MEETING_ID));
  const inMeeting = allInMeeting.slice(0, revealed);
  const hidden = new Set(allInMeeting.slice(revealed).map((ticket) => ticket.id));
  const transcriptTickets = tickets.filter((ticket) => !hidden.has(ticket.id));
  const shown = tab === "meetings" ? inMeeting.filter((ticket) => inTab(ticket, urgency, () => false)) : tickets;
  const selected = tickets.find((ticket) => ticket.id === selectedId);
  const select = (ticket: Ticket) => { setSelectedId(ticket.id); setJump((current) => ({ id: ticket.id, n: current.n + 1 })); };
  const change = (id: string, patch: Partial<Ticket>) => setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, ...patch } : ticket));
  const table = (rows: Ticket[]) => (
    <TicketTable rows={rows} selectedId={selectedId} hoveredId={hoveredId} followHover={false} rowHeight="medium" onHover={setHoveredId} onSelect={select} onExpand={noop} onChange={change} />
  );

  return (
    <Window title="Loopback" className="lp-demo">
      {/* The app's own header and nav (the same classes), with a stand-in account on the right. */}
      <header className="portal-header"><div className="brand-block"><Logo /></div></header>
      <nav className="portal-nav has-meetings" aria-label="Demo navigation">
        <button type="button" className={`nav-home ${tab === "home" ? "active" : ""}`} aria-label="Home" onClick={() => setTab("home")}><House size={16} /></button>
        <button type="button" className={tab === "tickets" ? "active" : ""} onClick={() => setTab("tickets")}><ClipboardList size={15} /> Tickets</button>
        <button type="button" className={`nav-meetings ${tab === "meetings" ? "active" : ""}`} onClick={() => setTab("meetings")}><CalendarDays size={15} /> Meetings</button>
        <div className="nav-account">
          <button type="button" className="nav-share" tabIndex={-1}><Link2 size={15} /> Share</button>
          <div className="nav-profile">
            <button type="button" className="nav-profile-button" aria-label="Demo account" tabIndex={-1}><span className="avatar" style={{ width: 30, height: 30, fontSize: 12 }} aria-hidden="true">CB</span></button>
          </div>
        </div>
      </nav>

      {tab === "home" ? (
        <main className="home-view">
          <div className="hero-banner" aria-label="Home page banner" style={{ "--hero-image": `url(${mural})` } as React.CSSProperties}>
            <div className="hero-content">
              <div className="hero-primary">
                <div className="hero-copy">
                  <p className="hero-board">{demoBoard.name}</p>
                  <h1>hey 👋,<br />how can we<br />help you?</h1>
                </div>
              </div>
              <div className="hero-actions">
                <button type="button" onClick={() => setTab("tickets")}><span>See Tickets on the Map</span><MapPin size={20} /></button>
                <button type="button" onClick={() => setTab("tickets")}><span>Look Up Tickets</span><Search size={20} /></button>
                <button type="button" onClick={() => document.getElementById("lp-mobile")?.scrollIntoView({ behavior: "smooth", block: "center" })}><span>Submit a New Ticket</span><Plus size={20} /></button>
              </div>
            </div>
          </div>
        </main>
      ) : tab === "meetings" ? (
        <>
          <div className="title-band meeting-band">
            <div className="meeting-heading">
              <h1>
                <span className="crumb">Meetings</span>
                <ChevronRight className="crumb-sep" size={24} aria-hidden="true" />
                <span title={demoMeeting.title}>{demoMeeting.title}</span>
              </h1>
              <span>Friday, October 23, 2026 · ~1h</span>
            </div>
            <button type="button" className={`generate meeting-generate ${generating ? "running" : "done"}`} disabled aria-busy={generating} title="Tickets and minutes are generated from the transcript">
              {generating && <span className="generate-fill" style={{ clipPath: `inset(0 ${100 - progress * 100}% 0 0)` }} aria-hidden="true" />}
              <Sparkles size={16} color={generating ? "#2bb7d5" : "#9aa1aa"} aria-hidden="true" />
              <span className="generate-label">{generating ? "Generating…" : "Generated"}</span>
            </button>
          </div>
          <div className="lp-columns">
            <section className="meeting-section" aria-label="Transcript">
              <header className="section-head"><span><FileText size={15} /> Transcript</span></header>
              <div className="section-body">
                <TranscriptView
                  bare
                  meetings={meetingList}
                  meeting={demoMeeting}
                  onMeetingChange={noop}
                  tickets={transcriptTickets}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                  onSpanChange={noop}
                  jump={jump}
                  typeClass={typeClass}
                  onHighlightClick={(id) => { const ticket = tickets.find((item) => item.id === id); if (ticket) select(ticket); }}
                />
              </div>
            </section>
            <section className={`meeting-section lp-col ${generating ? "lp-collapsed" : ""}`} aria-label="Tickets">
              <div className="lp-rail" aria-hidden="true"><ListChecks size={15} /><span>Tickets</span></div>
              <header className="section-head"><span><ListChecks size={15} /> Tickets<span className="tab-count">{inMeeting.length}</span></span></header>
              <div className="section-body">
                <UrgencyTabs tab={urgency} setTab={setUrgency} tickets={inMeeting} inReview={() => false} showReview={false} />
                {table(shown)}
              </div>
            </section>
            <section className={`meeting-section lp-col ${generating ? "lp-collapsed" : ""}`} aria-label="Minutes">
              <div className="lp-rail" aria-hidden="true"><NotebookText size={15} /><span>Minutes</span></div>
              <header className="section-head"><span><NotebookText size={15} /> Minutes</span></header>
              <div className="section-body">
                {generating ? null : <div className="minutes-body lp-minutes-in"><div className="ProseMirror" dangerouslySetInnerHTML={{ __html: demoMinutes }} /></div>}
              </div>
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="title-band"><div><h1>Tickets</h1><span>{tickets.length} tickets · {tickets.filter((ticket) => ticket.urgent).length} urgent</span></div></div>
          <div className="lp-tickets">
            <div className="lp-tickets-table">{table(shown)}</div>
            <div className="lp-tickets-map">
              <MapView tickets={tickets} selected={selected} hoveredId={hoveredId} focus={null} onHover={setHoveredId} onSelect={select} />
            </div>
          </div>
        </>
      )}
    </Window>
  );
}

/** What a resident sees at the board's share link: the tickets and the map, read only. */
function SharePage({ tickets }: { tickets: Ticket[] }) {
  const { name } = useBoard();
  const typeClass = useTypeClass();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  // The map moves on its own, stepping through the tickets, until the visitor touches the page.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !tickets.length) return;
    let index = 0;
    const step = () => { setSelectedId(tickets[index % tickets.length].id); index += 1; };
    const first = window.setTimeout(step, 1200);
    const timer = window.setInterval(step, 3000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [touched, tickets]);
  const search = query.trim().toLowerCase();
  const rows = search ? tickets.filter((ticket) => `${ticket.number} ${ticket.title} ${ticket.type} ${ticket.status} ${ticket.location.text}`.toLowerCase().includes(search)) : tickets;
  return (
    <Window title="Read-only view" className="lp-share" onPointerDown={() => setTouched(true)}>
      <div className="public-header">
        <Logo />
        <div className="public-heading"><h1>{name} tickets</h1><span className="role-badge">Read-only view</span></div>
      </div>
      <div className="public-main">
        <section className="public-summary">
          <strong>{tickets.length} tickets</strong>
          <span>{tickets.filter((ticket) => ticket.status !== "Closed").length} open</span>
          <input className="public-search" aria-label="Search tickets" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tickets" />
        </section>
        <div className="public-layout">
          <div className="public-table-wrap">
            <table className="public-table">
              <thead><tr><th>#</th><th>Title</th><th>Type</th><th>Status</th><th>Urgent</th><th>Location</th></tr></thead>
              <tbody>
                {rows.map((ticket) => (
                  <tr key={ticket.id} className={`${ticket.id === selectedId ? "selected" : ""} ${ticket.id === hoveredId ? "hovered" : ""}`} onMouseEnter={() => setHoveredId(ticket.id)} onMouseLeave={() => setHoveredId(null)} onClick={() => setSelectedId(ticket.id)}>
                    <td className="public-number">{ticket.number}</td>
                    <td className="public-title">{ticket.title}</td>
                    <td><span className={`tag type ${typeClass(ticket.type)}`}>{ticket.type}</span></td>
                    <td><span className={`tag status ${statusClass[ticket.status] ?? ""}`}><i />{ticket.status}</span></td>
                    <td>{ticket.urgent ? "Yes" : ""}</td>
                    <td>{ticket.location.places.map((place) => place.name).join("; ") || ticket.location.text}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={6} className="public-empty">No tickets match your search.</td></tr>}
              </tbody>
            </table>
          </div>
          <aside className="public-map">
            <MapView tickets={tickets} selected={tickets.find((ticket) => ticket.id === selectedId)} hoveredId={hoveredId} focus={null} onHover={setHoveredId} onSelect={(ticket) => setSelectedId(ticket.id)} half={window.innerWidth <= 900 ? "west" : undefined} />
          </aside>
        </div>
      </div>
    </Window>
  );
}

/** The intake form at phone width. It is drawn here rather than reusing IntakeForm, which fills the screen and
 *  grabs focus on mount; a submitted ticket joins the demo's list. */
function PhoneForm({ onSubmit }: { onSubmit: (ticket: Ticket) => void }) {
  const { ticketTypes } = useBoard();
  // The status bar clock shows the visitor's own local time, like a real phone.
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const clock = time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    trackEvent("landing_demo_ticket_submitted", { urgent });
    onSubmit({
      id: `demo-new-${Date.now()}`, number: "", title: title.trim(), type: type || "Other", status: "Open", location: { text: "", places: [] },
      requester: "", summary: summary.trim(), urgent, deadline, submittedBy: "Intake form", submittedAt: today(), meetingIds: [], spans: [],
      ownerId: null, source: "manual", closedAt: null, createdBy: null, evidence: {},
    });
    setSent(true);
  };
  const reset = () => { setTitle(""); setType(""); setUrgent(false); setDeadline(""); setSummary(""); setSent(false); };

  return (
    <div className="lp-phone">
      <div className="lp-phone-screen">
        <div className="lp-phone-status" aria-hidden="true"><span>{clock}</span><span className="lp-phone-icons"><Signal size={14} strokeWidth={2.6} /><Wifi size={14} strokeWidth={2.6} /><BatteryFull size={17} strokeWidth={2.2} /></span></div>
        <div className="lp-phone-brand"><Logo /></div>
        {sent ? (
          <div className="lp-phone-done">
            <h3>Thank you for submitting</h3>
            <p>Your ticket has been added to the demo list above. Nothing was sent anywhere.</p>
            <button type="button" className="lp-primary" onClick={reset}>Submit a new ticket</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="lp-phone-head"><h3>Submit a ticket</h3></div>
            <div className="lp-phone-fields">
              <label>Title <em>required</em>
                <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Broken streetlight on Avenue B" />
              </label>
              <label>Type
                <select value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="">Not sure yet</option>
                  {ticketTypes.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
                </select>
              </label>
              <label className="lp-check"><input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} /> Urgent</label>
              <label>Deadline
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
              </label>
              <label>Summary
                <textarea rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What is happening, and where?" />
              </label>
            </div>
            <div className="lp-phone-foot"><button type="submit" className="lp-primary">Submit</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
