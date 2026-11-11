import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { trackEvent } from "../../lib/analytics";

/** The "Contact our team" popup. Submit posts the form to Netlify Forms (the form named "contact" in index.html),
 *  and Netlify emails the team; the recipients are set in the Netlify dashboard, not in the code. Nothing the
 *  visitor types goes to analytics. */
export default function IntakeModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  // A honeypot: hidden from people, filled in by bots. Netlify drops any submission that has it.
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "form-name": "contact", email, details, website }).toString(),
      });
      trackEvent(response.ok ? "landing_contact_submitted" : "landing_contact_failed");
      setStatus(response.ok ? "sent" : "error");
    } catch {
      trackEvent("landing_contact_failed");
      setStatus("error");
    }
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
            {status === "error" && <p className="lp-modal-error" role="alert">Couldn't send your request. Please try again.</p>}
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
