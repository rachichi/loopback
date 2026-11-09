// Email magic link (default) or password sign-in. Accounts are invite-only (spec section 5), so there is no sign-up here.
import { useEffect, useState, type FormEvent } from "react";
import loopbackLogo from "./assets/logo.png";
import { db } from "./db";
import { setAnalyticsUser, trackEvent, trackPage } from "./lib/analytics";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"link" | "password">("link");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setAnalyticsUser(null);
    trackPage("/sign-in", "Sign in");
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (mode === "link") {
      // shouldCreateUser: false keeps this invite-only. Unknown emails get an error, not an account.
      const { error } = await db.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
        setError(error.message);
        return;
      }
      trackEvent("magic_link_sent");
      setSent(true);
      return;
    }
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    // On success the auth listener in App swaps this screen out, so only failures need handling here.
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    trackEvent("login", { method: "password" });
  };

  if (sent) {
    return (
      <main className="sign-in">
        <div className="sign-in-card">
          <img src={loopbackLogo} alt="Loopback" className="sign-in-logo" />
          <h1>Check your email</h1>
          <p>We sent a sign-in link to {email.trim()}. Open it on this device to finish signing in.</p>
          <button type="button" onClick={() => setSent(false)}>Use a different email</button>
        </div>
      </main>
    );
  }

  return (
    <main className="sign-in">
      <form className="sign-in-card" onSubmit={submit}>
        <img src={loopbackLogo} alt="Loopback" className="sign-in-logo" />
        <h1>Sign in</h1>
        <p>For community board staff. Ask your board's administrator for an account.</p>
        <label>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {mode === "password" && (
          <label>
            Password
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        )}
        {error && <p className="sign-in-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>
          {mode === "link" ? (busy ? "Sending…" : "Email me a sign-in link") : busy ? "Signing in…" : "Sign in"}
        </button>
        <button
          type="button"
          className="sign-in-switch"
          onClick={() => {
            setMode(mode === "link" ? "password" : "link");
            setError("");
          }}
        >
          {mode === "link" ? "Use a password instead" : "Email me a link instead"}
        </button>
      </form>
    </main>
  );
}
