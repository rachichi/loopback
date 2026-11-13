// How many files each ticket has, for the table's Attachments column. One query for the whole board: it reads
// only ticket ids, and RLS limits it to staff of the board. Refreshes when a file is added or removed anywhere.
import { useEffect, useState } from "react";
import { db } from "../../db";
import { useBoard } from "../../lib/board";

export const ATTACHMENTS_CHANGED = "loopback:attachments-changed";

export function useAttachmentCounts(enabled: boolean): ReadonlyMap<string, number> {
  const { id: board } = useBoard();
  const [counts, setCounts] = useState<ReadonlyMap<string, number>>(new Map());
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      db.from("ticket_attachments").select("ticket_id").eq("board", board).limit(5000).then(({ data, error }) => {
        if (cancelled || error) return;
        const next = new Map<string, number>();
        for (const row of (data ?? []) as { ticket_id: string }[]) next.set(row.ticket_id, (next.get(row.ticket_id) ?? 0) + 1);
        setCounts(next);
      });
    };
    load();
    window.addEventListener(ATTACHMENTS_CHANGED, load);
    return () => { cancelled = true; window.removeEventListener(ATTACHMENTS_CHANGED, load); };
  }, [board, enabled]);
  return counts;
}
