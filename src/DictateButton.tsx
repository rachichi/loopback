import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

// The Web Speech API isn't in TypeScript's DOM types; this is the part we use.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
const Recognizer = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
  ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

/** Whether this browser can dictate (Chrome, Edge and Safari can; Firefox can't). */
export const canDictate = Boolean(Recognizer);

/** A mic button that dictates into a field: click to start, click again (or pause) to stop. */
export default function DictateButton({ label, onText }: { label: string; onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => recognitionRef.current?.abort(), []);

  if (!Recognizer) return null;

  const toggle = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const recognition = new Recognizer();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) onTextRef.current(event.results[i][0].transcript.trim());
      }
    };
    recognition.onerror = (event) => setError(event.error === "not-allowed" ? "Microphone access is blocked" : "Couldn't hear that; try again");
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError("");
    setListening(true);
    recognition.start();
  };

  return (
    <button
      type="button"
      className={`dictate ${listening ? "listening" : ""}`}
      aria-label={listening ? `Stop dictating ${label}` : `Dictate ${label}`}
      aria-pressed={listening}
      title={error || (listening ? "Listening… click to stop" : `Speak the ${label.toLowerCase()}`)}
      onClick={toggle}
    >
      {error && !listening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  );
}
