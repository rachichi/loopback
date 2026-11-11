// The footer's "Contact us" form: report a bug, request a feature or share feedback. Submit sends two copies: one
// to Netlify Forms (the form named "feedback" in index.html), which emails the team (the recipients are set in the
// Netlify dashboard, not in the code), and one to the feedback table, a searchable record. It counts as sent if
// either worked: locally only the table is reachable, and before the migration only Netlify is. Nothing typed here
// goes to analytics, only the kind that was sent.
import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { db } from "../../db";
import { trackEvent } from "../../lib/analytics";
import { useBoard } from "../../lib/board";

type Kind = "bug" | "feature" | "feedback";
const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "bug", label: "Report a bug", hint: "What happened, and what did you expect to happen?" },
  { id: "feature", label: "Request a feature", hint: "What would you like Loopback to do?" },
  { id: "feedback", label: "Share feedback", hint: "Tell us about your experience." },
];

export default function FeedbackForm({ onClose }: { onClose: () => void }) {
  const { id: boardId, name: boardName } = useBoard();
  const [kind, setKind] = useState<Kind>("feedback");
  const [message, setMessage] = useState("");
  // A honeypot: hidden from people, filled in by bots. Netlify drops any submission that has it.
  const [botField, setBotField] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    const text = message.trim();
    const page = window.location.pathname;
    // The email. The sender's own address goes in it so the team can reply; it never goes to analytics.
    const toNetlify = async () => {
      const { data } = await db.auth.getUser();
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          "form-name": "feedback",
          "bot-field": botField,
          kind,
          message: text,
          board: `${boardName} (${boardId})`,
          page,
          from: data.user?.email ?? "not signed in",
        }).toString(),
      });
      return response.ok;
    };
    // The record. A bot that filled the honeypot is not recorded.
    const toTable = async () => {
      if (botField) return false;
      const { error } = await db.from("feedback").insert({ board: boardId, kind, message: text, page: page.slice(0, 300) });
      return !error;
    };
    const [emailed, recorded] = await Promise.all([toNetlify().catch(() => false), toTable().catch(() => false)]);
    const sent = emailed || recorded;
    trackEvent(sent ? "feedback_sent" : "feedback_failed", { board_id: boardId, kind });
    setStatus(sent ? "sent" : "error");
  };

  const current = KINDS.find((item) => item.id === kind)!;
  return (
    <div className="intake-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && status !== "sending") onClose(); }}>
      <form className="intake-form feedback-form" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onSubmit={submit}>
        <header>
          <h2 id="feedback-title">{status === "sent" ? "Thank you" : "Contact us"}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </header>
        {status === "sent" ? (
          <>
            <div className="intake-body"><p className="feedback-note">We got your message and will read it. Thank you for helping us improve Loopback.</p></div>
            <footer><button type="button" className="primary" onClick={onClose}>Close</button></footer>
          </>
        ) : (
          <>
            <div className="intake-body">
              <div className="feedback-kinds" role="group" aria-label="What is this about?">
                {KINDS.map((item) => (
                  <button key={item.id} type="button" aria-pressed={kind === item.id} className={kind === item.id ? "on" : ""} onClick={() => setKind(item.id)}>{item.label}</button>
                ))}
              </div>
              <textarea
                className="feedback-message"
                required
                autoFocus
                rows={6}
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={current.hint}
                aria-label={current.label}
              />
              <input className="feedback-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={botField} onChange={(event) => setBotField(event.target.value)} />
              <p className="feedback-note">Don&apos;t include names or details of residents. We see your email address so we can reply.</p>
              {status === "error" && <p className="feedback-error" role="alert">Couldn&apos;t send that. Please try again.</p>}
            </div>
            <footer>
              <button type="button" className="secondary" onClick={onClose} disabled={status === "sending"}>Cancel</button>
              <button type="submit" className="primary" disabled={status === "sending" || !message.trim()}>{status === "sending" ? "Sending…" : "Send"}</button>
            </footer>
          </>
        )}
      </form>
    </div>
  );
}
