import { useState } from "react";
import loopbackLogo from "./assets/logo.png";
import { useBoard } from "./lib/board";

/** Loopback x the board: the header lockup, also shown on the full-screen submit flow. */
export default function Logo() {
  const { name, logoUrl } = useBoard();
  // A logo that fails to load (bad URL, bucket not public) falls back to the board's name.
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <div className="brand-lockup" aria-label={`Loopback and ${name} branding`}>
      <div className="loopback-logo" aria-label="Loopback">
        <img src={loopbackLogo} alt="Loopback logo" className="loopback-logo-image" />
      </div>
      <span className="brand-divider" aria-hidden="true">×</span>
      <div className="board-logo">
        {logoUrl && !logoFailed
          ? <img src={logoUrl} alt={`${name} logo`} className="board-logo-image" onError={() => setLogoFailed(true)} />
          : <span className="board-logo-name">{name}</span>}
      </div>
    </div>
  );
}
