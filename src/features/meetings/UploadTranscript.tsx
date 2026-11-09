// The Meetings tab's "Upload transcript" form: staff add a transcript (a .txt or Zoom .vtt file, or pasted
// text) as a meeting in a folder. Zoom meetings have no YouTube video, so this is how they get in.
import { useRef, useState } from "react";
import { X } from "lucide-react";

/** A transcript file as text, one paragraph per line. WebVTT (Zoom) loses its header, cue numbers and timestamps. */
export function transcriptFromFile(name: string, raw: string): string {
  const text = raw.replace(/^﻿/, "");
  if (!/\.vtt$/i.test(name) && !/^WEBVTT/.test(text)) return text;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^WEBVTT/.test(line) && !/^NOTE\b/.test(line) && !/^\d+$/.test(line) && !/-->/.test(line))
    .join("\n");
}

export type UploadInput = { title: string; heldOn: string; folder: string; transcript: string };

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default function UploadTranscript({ folders, onClose, onUpload }: {
  /** The folders to pick from, in order. The first is selected to start with. */
  folders: string[];
  onClose: () => void;
  onUpload: (input: UploadInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [heldOn, setHeldOn] = useState(today());
  const [folder, setFolder] = useState(folders[0] ?? "Committee");
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File) => {
    setTranscript(transcriptFromFile(file.name, await file.text()));
    // A file named "Weekly sync.vtt" is a reasonable title to start from.
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onUpload({ title: title.trim(), heldOn, folder: folder.trim() || folders[0] || "Committee", transcript: transcript.trim() });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't add this transcript.");
      setSaving(false);
    }
  };

  return (
    <div className="intake-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form className="intake-form upload-form" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <header>
          <h2 id="upload-title">Upload transcript</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="intake-body">
          <label className="upload-field">
            <span className="form-field-name">Folder</span>
            <select value={folder} onChange={(event) => setFolder(event.target.value)}>
              {folders.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="upload-field">
            <span className="form-field-name">Title <em>required</em></span>
            <input type="text" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. District Service Cabinet, Nov 12" />
          </label>
          <label className="upload-field">
            <span className="form-field-name">Date</span>
            <input type="date" required value={heldOn} onChange={(event) => setHeldOn(event.target.value)} className="intake-date" />
          </label>
          <div className="upload-field">
            <span className="form-field-name">Transcript <em>required</em></span>
            <div className="upload-file">
              <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>Choose a .txt or .vtt file</button>
              <input ref={fileRef} type="file" accept=".txt,.vtt,text/plain,text/vtt" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }} />
              <span>or paste it below</span>
            </div>
            <textarea rows={8} required value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="One paragraph per line" />
          </div>
          {error && <div className="meeting-error" role="alert">{error}</div>}
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "Adding…" : "Add meeting"}</button>
        </footer>
      </form>
    </div>
  );
}
