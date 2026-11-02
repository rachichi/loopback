// The board's public read-only link, for staff and platform admins to copy or replace.
// Replacing it (rotate_share_token) stops every copy of the old link at once.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { db } from "./db";
import { useBoard } from "./lib/board";
import { trackEvent } from "./lib/analytics";

export const shareUrl = (token: string) => `${window.location.origin}/share/${token}`;

export default function ShareLink({ onClose }: { onClose: () => void }) {
  const board = useBoard();
  // Local, because the board in context was loaded once and a new link must show straight away.
  const [token, setToken] = useState(board.shareToken);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      trackEvent("share_link_copied", { board_id: board.id });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the link and copy it by hand.");
    }
  };

  const replace = async () => {
    if (!window.confirm("Make a new link? The current link will stop working for everyone who has it.")) return;
    setBusy(true);
    setError("");
    const { data, error } = await db.rpc("rotate_share_token", { b: board.id });
    setBusy(false);
    if (error || typeof data !== "string") {
      setError(error?.message ?? "Couldn't make a new link.");
      return;
    }
    setToken(data);
    trackEvent("share_link_replaced", { board_id: board.id });
    setCopied(false);
  };

  // Portaled to <body>: the button lives in the sticky nav, whose stacking context would trap the dialog.
  return createPortal(
    <div className="intake-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="intake-form share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <header>
          <h2 id="share-title">Share a read-only view</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="intake-fields">
          <p className="wide share-note">
            Anyone with this link can see {board.name}'s tickets and map without signing in. They see the number,
            title, type, status, urgency, deadline, location and submitted date. They never see requesters,
            summaries or who submitted a ticket, and they can't change anything.
          </p>
          {token ? (
            <div className="wide share-row">
              <input readOnly aria-label="Share link" value={shareUrl(token)} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" className="share-copy" onClick={copy}>
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
          ) : (
            <p className="wide share-note">This board has no share link yet.</p>
          )}
          {error && <p className="wide share-error" role="alert">{error}</p>}
        </div>
        <footer>
          <button type="button" className="secondary" disabled={busy} onClick={replace}>
            {busy ? "Making a new link…" : token ? "Make a new link" : "Create a link"}
          </button>
          <button type="button" className="primary" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
