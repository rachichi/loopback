import { useEffect, useState } from "react";
import IntakeForm, { type IntakeFields } from "./IntakeForm";
import Logo from "./Logo";
import { useBoard } from "./lib/board";

/** Loopback x the board's logo (or name), so the form is clearly this board's. */
function BoardMark() {
  return <div className="submit-board"><Logo /></div>;
}

/** The intake form on its own full screen: fill it in, submit, then a thank-you screen with a button for the
 *  next ticket. Used on phones and for the ?submit link (a walk-in desk or a shared link). */
export default function SubmitFlow({ onSubmit, onExit, onStart }: {
  onSubmit: (fields: IntakeFields) => void;
  /** Leaves the flow (Home). */
  onExit: () => void;
  /** A blank form appeared, for the form timing. */
  onStart: () => void;
}) {
  const { name } = useBoard();
  // Each new ticket gets a fresh form: the key remounts it empty.
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) onStart(); }, [round, done, onStart]);

  if (done) {
    return (
      <main className="submit-done">
        <BoardMark />
        <h1>Thank you for submitting</h1>
        <p>Your ticket has been sent to {name}.</p>
        <button type="button" className="primary" onClick={() => { setRound((n) => n + 1); setDone(false); }}>Submit a new ticket</button>
        <button type="button" className="link" onClick={onExit}>Back to home</button>
      </main>
    );
  }
  return <IntakeForm key={round} page banner={<BoardMark />} onSubmit={(fields) => { onSubmit(fields); setDone(true); }} onClose={onExit} />;
}
