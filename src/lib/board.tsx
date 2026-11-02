// The signed-in user's board: name, logo, boundary, ticket types and resolved feature flags.
// Loaded once after sign-in in three steps (board_members, then boards, then board_effective_features).
// Nothing below the provider renders until the board has resolved, so no board-specific UI can show
// with missing or stale data.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { db } from "../db";

export type BoardTicketType = { label: string; css_class: string; definition: string };

export type Board = {
  id: string;
  name: string;
  borough: string;
  logoUrl: string | null;
  boundary: GeoJSON.GeoJsonObject | null;
  ticketTypes: BoardTicketType[];
  /** Resolved flags from board_effective_features. Read them through useFeature. */
  features: Record<string, boolean>;
  role: "admin" | "staff";
};

type BoardState =
  | { status: "loading" }
  | { status: "ready"; board: Board }
  | { status: "no-board" }
  | { status: "error"; message: string };

const BoardContext = createContext<Board | null>(null);

async function loadBoard(userId: string): Promise<Board | null> {
  // A user can belong to more than one board. V1 has no board switcher, so take the first by id.
  const { data: member, error: memberError } = await db
    .from("board_members")
    .select("board_id, role")
    .eq("user_id", userId)
    .order("board_id")
    .limit(1)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) return null;

  const { data: row, error: boardError } = await db
    .from("boards")
    .select("id, name, borough, logo_url, boundary_geojson, ticket_types")
    .eq("id", member.board_id)
    .single();
  if (boardError) throw boardError;

  const { data: flags, error: flagsError } = await db
    .from("board_effective_features")
    .select("features")
    .eq("board_id", member.board_id)
    .maybeSingle();
  if (flagsError) throw flagsError;

  // Keep only true booleans, so a malformed value reads as off.
  const features: Record<string, boolean> = {};
  for (const [key, value] of Object.entries((flags?.features ?? {}) as Record<string, unknown>)) {
    features[key] = value === true;
  }

  return {
    id: row.id,
    name: row.name,
    borough: row.borough,
    logoUrl: row.logo_url,
    boundary: row.boundary_geojson,
    ticketTypes: Array.isArray(row.ticket_types) ? row.ticket_types : [],
    features,
    role: member.role,
  };
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

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadBoard(userId)
      .then((board) => {
        if (!cancelled) setState(board ? { status: "ready", board } : { status: "no-board" });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (state.status === "loading") return <BoardStatus>Loading your board…</BoardStatus>;
  if (state.status === "no-board") {
    return (
      <BoardStatus>
        Your account isn't a member of any community board yet. Ask an administrator to add you.
      </BoardStatus>
    );
  }
  if (state.status === "error") return <BoardStatus>Couldn't load your board: {state.message}</BoardStatus>;
  return <BoardContext.Provider value={state.board}>{children}</BoardContext.Provider>;
}

/** The current board. Only valid below BoardProvider, which renders its children once the board has resolved. */
export function useBoard(): Board {
  const board = useContext(BoardContext);
  if (!board) throw new Error("useBoard() must be used inside <BoardProvider>.");
  return board;
}

/** Whether a feature is on for the current board. Unknown keys are off. */
export function useFeature(key: string): boolean {
  return useBoard().features[key] === true;
}
