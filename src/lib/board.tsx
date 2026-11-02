// The signed-in user's board: name, logo, boundary, ticket types, resolved feature flags and their role.
// Loaded after sign-in: the user's memberships and platform-admin status, then the chosen board's row and
// its flags from board_effective_features. Nothing below the provider renders until the board has
// resolved, so no board-specific UI can show with missing or stale data.
//
// Roles. The database enforces them (can_edit_board and the ticket policies).
//   platform_admin  every board, read and write
//   staff           their board, read and write (the legacy board role "admin" counts as staff)
// Read-only access for everyone else is the board's public share link (src/PublicBoard.tsx), not a role.
import { createContext, Fragment, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { db } from "../db";
import type { FeatureKey } from "./features";

export type BoardTicketType = { label: string; css_class: string; definition: string };
export type Role = "platform_admin" | "staff";

export type Board = {
  id: string;
  name: string;
  borough: string;
  logoUrl: string | null;
  /** Home page photo, from the board-assets Storage bucket. */
  backgroundUrl: string | null;
  boundary: GeoJSON.GeoJsonObject | null;
  ticketTypes: BoardTicketType[];
  /** Resolved flags from board_effective_features. Read them through useFeature. */
  features: Record<string, boolean>;
  /** Null on the public share page, where nobody is signed in. */
  role: Role | null;
  /** Secret part of the board's public read-only link (/share/<token>); null when sharing is off. */
  shareToken: string | null;
};

/** A board the user can switch to: every board for a platform admin, their own boards otherwise. */
export type BoardOption = { id: string; name: string };

type Access = { boards: BoardOption[]; memberships: Map<string, string>; platformAdmin: boolean };

type BoardState =
  | { status: "loading" }
  | { status: "ready"; board: Board; boards: BoardOption[] }
  | { status: "no-board" }
  | { status: "error"; message: string };

const BoardContext = createContext<Board | null>(null);
const SwitcherContext = createContext<{ boards: BoardOption[]; switchBoard: (id: string) => void } | null>(null);

// The last board picked in the switcher, per browser. A convenience only; it may be unavailable.
const STORAGE_KEY = "loopback.boardId";
const readStoredBoard = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
const storeBoard = (id: string) => { try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage unavailable */ } };

async function loadAccess(userId: string): Promise<Access> {
  const [members, admin] = await Promise.all([
    db.from("board_members").select("board_id, role").eq("user_id", userId),
    db.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (members.error) throw members.error;
  if (admin.error) throw admin.error;
  const memberships = new Map<string, string>((members.data ?? []).map((row) => [row.board_id, row.role]));
  const platformAdmin = Boolean(admin.data);
  if (!platformAdmin && !memberships.size) return { boards: [], memberships, platformAdmin };

  // RLS already limits boards to the user's own unless they are a platform admin.
  const { data, error } = await db.from("boards").select("id, name").order("name");
  if (error) throw error;
  return { boards: (data ?? []) as BoardOption[], memberships, platformAdmin };
}

async function loadBoard(boardId: string, access: Access): Promise<Board> {
  const { data: row, error: boardError } = await db
    .from("boards")
    .select("id, name, borough, logo_url, background_url, boundary_geojson, ticket_types, share_token")
    .eq("id", boardId)
    .single();
  if (boardError) throw boardError;

  const { data: flags, error: flagsError } = await db
    .from("board_effective_features")
    .select("features")
    .eq("board_id", boardId)
    .maybeSingle();
  if (flagsError) throw flagsError;

  // Keep only true booleans, so a malformed value reads as off.
  const features: Record<string, boolean> = {};
  for (const [key, value] of Object.entries((flags?.features ?? {}) as Record<string, unknown>)) {
    features[key] = value === true;
  }

  const role: Role = access.platformAdmin ? "platform_admin" : "staff";

  return {
    id: row.id,
    name: row.name,
    borough: row.borough,
    logoUrl: row.logo_url,
    backgroundUrl: row.background_url,
    boundary: row.boundary_geojson,
    ticketTypes: Array.isArray(row.ticket_types) ? row.ticket_types : [],
    features,
    role,
    shareToken: row.share_token,
  };
}

/** The board to open: the last one picked if still allowed, else the user's first membership, else the first board. */
function initialBoard(access: Access): string | undefined {
  const allowed = new Set(access.boards.map((board) => board.id));
  const stored = readStoredBoard();
  if (stored && allowed.has(stored)) return stored;
  const member = [...access.memberships.keys()].sort().find((id) => allowed.has(id));
  return member ?? access.boards[0]?.id;
}

/** Shown in place of the app while the board loads or when it can't. Deliberately board-neutral. */
function BoardStatus({ children }: { children: ReactNode }) {
  return (
    <main className="board-status" role="status">
      <div>{children}</div>
      <button type="button" className="board-status-signout" onClick={() => void db.auth.signOut()}>
        Sign out
      </button>
    </main>
  );
}

export function BoardProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<BoardState>({ status: "loading" });
  const [access, setAccess] = useState<Access | null>(null);
  const [boardId, setBoardId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadAccess(userId)
      .then((loaded) => {
        if (cancelled) return;
        const first = initialBoard(loaded);
        if (!first) { setState({ status: "no-board" }); return; }
        setAccess(loaded);
        setBoardId(first);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!access || !boardId) return;
    let cancelled = false;
    setState({ status: "loading" });
    loadBoard(boardId, access)
      .then((board) => { if (!cancelled) setState({ status: "ready", board, boards: access.boards }); })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => { cancelled = true; };
  }, [access, boardId]);

  const switchBoard = useCallback((id: string) => {
    storeBoard(id);
    setBoardId(id);
  }, []);

  if (state.status === "loading") return <BoardStatus>Loading your board…</BoardStatus>;
  if (state.status === "no-board") {
    return (
      <BoardStatus>
        Your account isn't a member of any community board yet. Ask an administrator to add you.
      </BoardStatus>
    );
  }
  if (state.status === "error") return <BoardStatus>Couldn't load your board: {state.message}</BoardStatus>;
  return (
    <SwitcherContext.Provider value={{ boards: state.boards, switchBoard }}>
      <BoardContext.Provider value={state.board}>
        {/* Keyed by board, so switching boards starts the portal fresh instead of carrying over tickets. */}
        <Fragment key={state.board.id}>{children}</Fragment>
      </BoardContext.Provider>
    </SwitcherContext.Provider>
  );
}

/** Provides an already-loaded board without sign-in, for the public share page. There is one board and
 *  nothing to switch to. */
export function StaticBoardProvider({ board, children }: { board: Board; children: ReactNode }) {
  return (
    <SwitcherContext.Provider value={{ boards: [{ id: board.id, name: board.name }], switchBoard: () => {} }}>
      <BoardContext.Provider value={board}>{children}</BoardContext.Provider>
    </SwitcherContext.Provider>
  );
}

/** The current board. Only valid below BoardProvider, which renders its children once the board has resolved. */
export function useBoard(): Board {
  const board = useContext(BoardContext);
  if (!board) throw new Error("useBoard() must be used inside <BoardProvider>.");
  return board;
}

/** Maps a ticket type label to its css_class from boards.ticket_types. The class sets the tag and
 *  highlight colors in src/index.css. A label the board doesn't define gets the neutral "other" style. */
export function useTypeClass(): (type: string) => string {
  const { ticketTypes } = useBoard();
  return (type) => ticketTypes.find((item) => item.label === type)?.css_class || "other";
}

/** The boards the user can switch between, and the switch itself. */
export function useBoardSwitcher() {
  const switcher = useContext(SwitcherContext);
  if (!switcher) throw new Error("useBoardSwitcher() must be used inside <BoardProvider>.");
  return switcher;
}

/** Whether a feature is on for the current board. Keys are typed by FeatureKey (./features); a key the
 *  database doesn't return reads as off. This only hides UI: anything that costs money or touches
 *  secrets must also be checked server-side. */
export function useFeature(key: FeatureKey): boolean {
  return useBoard().features[key] === true;
}
