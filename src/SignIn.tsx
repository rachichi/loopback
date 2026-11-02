// Email and password sign-in. Accounts are invite-only (spec section 5), so there is no sign-up here.
import { useEffect, useState, type FormEvent } from "react";
import loopbackLogo from "./assets/logo.png";
import { db } from "./db";
import { trackEvent, trackPage } from "./lib/analytics";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => trackPage("/sign-in", "Sign in"), []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    // On success the auth listener in App swaps this screen out, so only failures need handling here.
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    trackEvent("login", { method: "password" });
  };

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
        <label>
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="sign-in-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
