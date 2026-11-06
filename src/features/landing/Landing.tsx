// The public landing page (part 1: local only, reached at /landing). A header, a hero on the app's blue band, a
// clickable demo of the Meetings tab built from the app's own components, the resident share page, the phone
// intake form and a closing call to action. Everything is fake and lives in this page's state: no database
// calls, no sign-in, nothing saved. Loaded with React.lazy from App.tsx so none of it reaches the entry chunk.
import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, ChevronDown, ChevronRight, ClipboardList, FileText, House, Link2, ListChecks, MapPin, NotebookText, Plus, Search, Sparkles, X } from "lucide-react";
import loopbackLogo from "../../assets/logo.png";
import { db } from "../../db";
import Logo from "../../Logo";
import MapView from "../../MapView";
import TicketTable from "../../TicketTable";
import TranscriptView from "../../TranscriptView";
import { inTab, UrgencyTabs, type UrgencyTab } from "../../TicketFilters";
import { StaticBoardProvider, useBoard, useTypeClass } from "../../lib/board";
import { statusClass, today, type Ticket } from "../tickets/types";
import timesSquare from "./assets/bg-times-square.jpg";
import bridge from "./assets/bg-bridge.jpg";
import mural from "./assets/bg-mural.jpg";
import { demoBoard } from "./demoBoard";
import { DEMO_MEETING_ID, demoMeeting, demoMinutes, demoTickets } from "./demoData";
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

const meetingList = [{ id: DEMO_MEETING_ID, title: demoMeeting.title }];
const noop = () => {};

export default function Landing() {
  const [intakeOpen, setIntakeOpen] = useState(false);
  // The demo's tickets. Edits and the phone form change this copy only, and a reload starts over.
  const [tickets, setTickets] = useState<Ticket[]>(demoTickets);
  const open = () => setIntakeOpen(true);

  return (
    <div className="lp">
      <header className="lp-header">
        <a className="lp-brand" href="/landing" aria-label="Loopback">
          <img src={loopbackLogo} alt="" />
          <span>Loopback</span>
        </a>
        <a className="lp-signin" href={APP_URL}>Sign in</a>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-inner">
          <h1>Loopback is the tool for community boards.</h1>
          <button type="button" className="lp-cta" onClick={open}>Get Loopback for your board <ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </section>

      <StaticBoardProvider board={demoBoard}>
        <div className="lp-stage">
          <DemoApp tickets={tickets} setTickets={setTickets} />
        </div>

        <section className="lp-feature">
          <div className="lp-feature-text">
            <h2>Share link for residents</h2>
            <p>Share progress on requests to residents.</p>
          </div>
          <Backdrop image={timesSquare} className="lp-feature-visual"><SharePage tickets={tickets} /></Backdrop>
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
        <button type="button" className="lp-cta" onClick={open}>Get Loopback for your board <ChevronRight size={18} aria-hidden="true" /></button>
      </section>

      {/* The app's footer, with Contact us opening the same popup as the buttons. */}
      <footer className="portal-footer">
        <div className="portal-footer-inner">
          <img src={loopbackLogo} alt="Loopback" />
          <div className="portal-footer-contact">
            <p>Loopback for community boards.</p>
            <p>The Loopback portal was launched in 2026 by community members<br />to empower the community boards that serve them.</p>
            <p><button type="button" className="lp-footer-link" onClick={open}>Contact us</button> for questions, feedback, or feature requests.</p>
          </div>
        </div>
      </footer>

      {intakeOpen && <IntakeModal onClose={() => setIntakeOpen(false)} />}
    </div>
  );
}

/** A window frame like the Cursor page's: three dots and a title over whatever it holds. */
function Window({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`lp-window ${className}`}>
      <div className="lp-window-bar" aria-hidden="true"><i /><i /><i /><span>{title}</span></div>
      {children}
    </div>
  );
}

/** The signed-in app: a Tickets tab and the Meetings tab, which opens already generated with all three columns. */
function DemoApp({ tickets, setTickets }: { tickets: Ticket[]; setTickets: React.Dispatch<React.SetStateAction<Ticket[]>> }) {
  const typeClass = useTypeClass();
  const [tab, setTab] = useState<"home" | "tickets" | "meetings">("meetings");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [jump, setJump] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  const [urgency, setUrgency] = useState<UrgencyTab>("all");

  const inMeeting = tickets.filter((ticket) => ticket.meetingIds.includes(DEMO_MEETING_ID));
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
            <button type="button" className="generate meeting-generate done" disabled title="Tickets and minutes were already generated for this meeting">
              <Sparkles size={16} color="#9aa1aa" aria-hidden="true" />
              <span className="generate-label">Generated</span>
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
                  tickets={tickets}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                  onSpanChange={noop}
                  jump={jump}
                  typeClass={typeClass}
                  onHighlightClick={(id) => { const ticket = tickets.find((item) => item.id === id); if (ticket) select(ticket); }}
                />
              </div>
            </section>
            <section className="meeting-section" aria-label="Tickets">
              <header className="section-head"><span><ListChecks size={15} /> Tickets<span className="tab-count">{inMeeting.length}</span></span></header>
              <div className="section-body">
                <UrgencyTabs tab={urgency} setTab={setUrgency} tickets={inMeeting} inReview={() => false} showReview={false} />
                {table(shown)}
              </div>
            </section>
            <section className="meeting-section" aria-label="Minutes">
              <header className="section-head"><span><NotebookText size={15} /> Minutes</span></header>
              <div className="section-body">
                <div className="minutes-body"><div className="ProseMirror" dangerouslySetInnerHTML={{ __html: demoMinutes }} /></div>
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
  const search = query.trim().toLowerCase();
  const rows = search ? tickets.filter((ticket) => `${ticket.number} ${ticket.title} ${ticket.type} ${ticket.status} ${ticket.location.text}`.toLowerCase().includes(search)) : tickets;
  return (
    <Window title="Read-only view" className="lp-share">
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
            <MapView tickets={tickets} selected={tickets.find((ticket) => ticket.id === selectedId)} hoveredId={hoveredId} focus={null} onHover={setHoveredId} onSelect={(ticket) => setSelectedId(ticket.id)} />
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
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
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

/** The "Contact our team" popup. Submit sends the request to the submit-lead Edge Function, which saves it in
 *  Supabase and emails the team. Nothing the visitor types goes to analytics. */
function IntakeModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  // A honeypot: hidden from people, filled in by bots. The function drops any request that has it.
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    const { error, response } = await db.functions.invoke("submit-lead", { body: { email, details, website } }).then(
      (result) => ({ error: result.error, response: result.error && "context" in result.error ? (result.error.context as Response) : null }),
    );
    if (!error) { setStatus("sent"); return; }
    // The function's own message (for example an invalid email) when it sent one.
    const reason = await response?.json().then((body: { error?: string }) => body.error).catch(() => undefined);
    setMessage(reason ?? "Couldn't send your request. Please try again.");
    setStatus("error");
  };

  return (
    <div className="lp-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="lp-modal" role="dialog" aria-modal="true" aria-labelledby="lp-contact-title" onSubmit={submit}>
        <button type="button" className="lp-modal-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        {status === "sent" ? (
          <>
            <h2 id="lp-contact-title">Thank you</h2>
            <p className="lp-modal-note">We'll be in touch about Loopback for your board.</p>
            <div className="lp-modal-actions"><button type="button" className="lp-primary" onClick={onClose}>Close</button></div>
          </>
        ) : (
          <>
            <h2 id="lp-contact-title">Contact our team</h2>
            <label>Email<span aria-hidden="true">*</span>
              <input type="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>Additional details<span aria-hidden="true">*</span>
              <textarea required rows={5} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="What community board and city are you a part of? How are you looking to use Loopback?" />
            </label>
            <input className="lp-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(event) => setWebsite(event.target.value)} />
            {status === "error" && <p className="lp-modal-error" role="alert">{message}</p>}
            <div className="lp-modal-actions">
              <button type="button" className="lp-secondary" onClick={onClose}>Back</button>
              <button type="submit" className="lp-primary" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Submit →"}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
