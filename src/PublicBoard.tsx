// The public, read-only page behind a board's share link (/share/<token>). No sign-in.
// Data comes only from public_board and public_board_tickets, which return a fixed set of fields
// with no personal details; the tables themselves stay closed to anonymous visitors.
import { useCallback, useEffect, useMemo, useState } from "react";
import loopbackLogo from "./assets/logo.png";
import { db } from "./db";
import { StaticBoardProvider, useBoard, useFeature, useTypeClass, type Board } from "./lib/board";
import { statusClass, type Status, type Ticket } from "./features/tickets/types";
import { featureFlags } from "./lib/features";
import MapView from "./MapView";

type PublicBoardRow = {
  id: string;
  name: string;
  borough: string;
  logo_url: string | null;
  background_url: string | null;
  boundary_geojson: GeoJSON.GeoJsonObject | null;
  ticket_types: unknown;
  /** Resolved flags; absent before migration 20261102170000, when the defaults in features.ts apply. */
  features?: Record<string, unknown> | null;
};

type PublicTicketRow = {
  id: string;
  number: number;
  title: string;
  type: string;
  status: string;
  urgent: boolean;
  deadline: string | null;
  location_text: string;
  places: Ticket["location"]["places"];
  submitted_at: string;
};

type State =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; board: Board; tickets: Ticket[] };

// The public functions return only these fields, so the rest of Ticket is filled with empty values.
const toTicket = (row: PublicTicketRow): Ticket => ({
  id: row.id,
  number: String(row.number),
  title: row.title,
  type: row.type,
  status: row.status as Status,
  urgent: row.urgent,
  deadline: row.deadline ?? "",
  location: { text: row.location_text, places: row.places ?? [] },
  requester: "",
  summary: "",
  submittedBy: "",
  submittedAt: row.submitted_at,
  meetingIds: [],
  spans: [],
  evidence: {},
  ownerId: null,
  source: "manual",
  closedAt: null,
  createdBy: null,
});

async function load(token: string): Promise<State> {
  const [boardResult, ticketsResult] = await Promise.all([
    db.rpc("public_board", { token }),
    db.rpc("public_board_tickets", { token }),
  ]);
  if (boardResult.error) throw boardResult.error;
  if (ticketsResult.error) throw ticketsResult.error;
  const row = (boardResult.data as PublicBoardRow[] | null)?.[0];
  if (!row) return { status: "not-found" };
  const board: Board = {
    id: row.id,
    name: row.name,
    borough: row.borough,
    logoUrl: row.logo_url,
    backgroundUrl: row.background_url,
    boundary: row.boundary_geojson,
    ticketTypes: Array.isArray(row.ticket_types) ? row.ticket_types : [],
    // Same rule as BoardProvider: only true counts as on. Without flags from the database (migration not
    // applied yet), fall back to the documented defaults so the map and intake stay on.
    features: row.features
      ? Object.fromEntries(Object.entries(row.features).map(([key, value]) => [key, value === true]))
      : Object.fromEntries(Object.entries(featureFlags).map(([key, flag]) => [key, flag.defaultEnabled])),
    role: null,
    shareToken: null,
  };
  return { status: "ready", board, tickets: ((ticketsResult.data as PublicTicketRow[] | null) ?? []).map(toTicket) };
}

const formatDate = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function PublicBoard({ token }: { token: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    load(token)
      .then((next) => { if (!cancelled) setState(next); })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => { cancelled = true; };
  }, [token]);

  if (state.status === "loading") return <main className="board-status" role="status">Loading…</main>;
  if (state.status === "not-found") {
    return (
      <main className="board-status" role="status">
        This link doesn't work. It may have been replaced with a new one; ask the community board for the current link.
      </main>
    );
  }
  if (state.status === "error") return <main className="board-status" role="status">Couldn't load this board: {state.message}</main>;

  return (
    <StaticBoardProvider board={state.board}>
      <PublicView tickets={state.tickets} />
    </StaticBoardProvider>
  );
}

function PublicView({ tickets }: { tickets: Ticket[] }) {
  const typeClass = useTypeClass();
  const mapOn = useFeature("district_map");
  const [selectedId, setSelectedId] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const selected = tickets.find((ticket) => ticket.id === selectedId);
  const onHover = useCallback((id: string | null) => setHoveredId(id), []);
  const onSelect = useCallback((ticket: Ticket) => setSelectedId(ticket.id), []);

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return tickets;
    return tickets.filter((ticket) =>
      `${ticket.number} ${ticket.title} ${ticket.type} ${ticket.status} ${ticket.location.text} ${ticket.location.places.map((place) => place.name).join(" ")}`
        .toLowerCase()
        .includes(search),
    );
  }, [tickets, query]);
  const open = tickets.filter((ticket) => ticket.status !== "Closed").length;

  return (
    <div className="portal public-portal">
      <PublicHeader />
      <main className="public-main">
        <section className="public-summary">
          <strong>{tickets.length} tickets</strong>
          <span>{open} open</span>
          <input className="public-search" aria-label="Search tickets" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tickets" />
        </section>
        <div className={`public-layout ${mapOn ? "" : "no-map"}`}>
          <div className="public-table-wrap">
            <table className="public-table">
              <thead>
                <tr>
                  <th>#</th><th>Title</th><th>Type</th><th>Status</th><th>Urgent</th><th>Deadline</th><th>Location</th><th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className={`${ticket.id === selectedId ? "selected" : ""} ${ticket.id === hoveredId ? "hovered" : ""}`}
                    onMouseEnter={() => setHoveredId(ticket.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedId(ticket.id)}
                  >
                    <td className="public-number">{ticket.number}</td>
                    <td className="public-title">{ticket.title}</td>
                    <td><span className={`tag type ${typeClass(ticket.type)}`}>{ticket.type}</span></td>
                    <td><span className={`tag status ${statusClass[ticket.status] ?? ""}`}><i />{ticket.status}</span></td>
                    <td>{ticket.urgent ? "Yes" : ""}</td>
                    <td>{formatDate(ticket.deadline)}</td>
                    <td>{ticket.location.places.map((place) => place.name).join("; ") || ticket.location.text}</td>
                    <td>{formatDate(ticket.submittedAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={8} className="public-empty">{tickets.length ? "No tickets match your search." : "No tickets yet."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {mapOn && (
            <aside className="public-map">
              <MapView tickets={tickets} selected={selected} hoveredId={hoveredId} focus={null} onHover={onHover} onSelect={onSelect} />
            </aside>
          )}
        </div>
      </main>
      <footer className="public-footer">
        A read-only view shared by the community board. Personal details are not shown.
      </footer>
    </div>
  );
}

/** Loopback and the board's logo (or name), marked as a read-only view. */
function PublicHeader() {
  const { name, logoUrl } = useBoard();
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <header className="public-header">
      <div className="brand-lockup" aria-label={`Loopback and ${name}`}>
        <div className="loopback-logo"><img src={loopbackLogo} alt="Loopback logo" className="loopback-logo-image" /></div>
        <span className="brand-divider" aria-hidden="true">×</span>
        <div className="board-logo">
          {logoUrl && !logoFailed
            ? <img src={logoUrl} alt={`${name} logo`} className="board-logo-image" onError={() => setLogoFailed(true)} />
            : <span className="board-logo-name">{name}</span>}
        </div>
      </div>
      <div className="public-heading">
        <h1>{name} tickets</h1>
        <span className="role-badge">Read-only view</span>
      </div>
    </header>
  );
}
