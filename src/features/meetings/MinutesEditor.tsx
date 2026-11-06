// The Minutes section: the AI draft in a rich-text editor. Staff edit it, copy it, and edits save after a pause.
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Copy, Heading2, Italic, List, ListOrdered } from "lucide-react";
import { loadMinutes, saveMinutes } from "../transcript/api";

export default function MinutesEditor({ meetingId, canEdit, onCopied, onEdited }: {
  meetingId: string;
  canEdit: boolean;
  onCopied: () => void;
  /** Called after an edit is saved, so the meeting's "Edited" status refreshes. */
  onEdited: () => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loaded = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editable: canEdit,
    onUpdate: ({ editor: current }) => {
      if (!loaded.current) return;
      setSaved("saving");
      window.clearTimeout(timer.current);
      const html = current.getHTML();
      timer.current = window.setTimeout(() => {
        saveMinutes(meetingId, html)
          .then(() => { setSaved("saved"); onEdited(); })
          .catch((error) => { console.error(error); setSaved("error"); });
      }, 800);
    },
  });

  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    loaded.current = false;
    setState("loading");
    loadMinutes(meetingId)
      .then((html) => {
        if (cancelled) return;
        editor.commands.setContent(html ?? "", { emitUpdate: false });
        loaded.current = true;
        setState("ready");
      })
      .catch((error) => { console.error(error); if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [editor, meetingId]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!editor) return null;
  const copy = async () => {
    const html = editor.getHTML();
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([editor.getText({ blockSeparator: "\n" })], { type: "text/plain" }),
      })]);
    } catch {
      await navigator.clipboard.writeText(editor.getText({ blockSeparator: "\n" }));
    }
    onCopied();
  };
  const tool = (label: string, active: boolean, run: () => void, icon: React.ReactNode) => (
    <button type="button" aria-label={label} title={label} className={active ? "active" : ""} disabled={!canEdit} onMouseDown={(event) => event.preventDefault()} onClick={run}>{icon}</button>
  );
  return (
    <div className="minutes-editor">
      <div className="minutes-toolbar">
        {tool("Bold", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold size={14} />)}
        {tool("Italic", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic size={14} />)}
        {tool("Heading", editor.isActive("heading"), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={14} />)}
        {tool("Bulleted list", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <List size={14} />)}
        {tool("Numbered list", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={14} />)}
        <span className="minutes-saved" role="status">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : saved === "error" ? "Couldn't save" : ""}</span>
        <button type="button" className="minutes-copy" onClick={copy}><Copy size={13} /> Copy</button>
      </div>
      {state === "loading" && <div className="transcript-empty">Loading minutes…</div>}
      {state === "error" && <div className="transcript-empty">Couldn't load the minutes.</div>}
      <EditorContent editor={editor} className={`minutes-body ${state === "ready" ? "" : "hidden"}`} />
    </div>
  );
}
