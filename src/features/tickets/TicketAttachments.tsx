// The Attachments field of the expanded ticket form: the ticket's files, a way to open each, and (for staff) to add
// and remove them. Files are private; opening one asks for a link that works for a minute.
import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { trackEvent } from "../../lib/analytics";
import { useBoard } from "../../lib/board";
import { addAttachment, ATTACHMENT_ACCEPT, ATTACHMENT_KINDS, attachmentLink, attachmentProblem, loadAttachments, MAX_ATTACHMENT_BYTES, removeAttachment, type Attachment } from "./attachments";

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function TicketAttachments({ ticketId, saved }: {
  ticketId: string;
  /** False until the database has the ticket (it gets its number then). Files can't be attached before that. */
  saved: boolean;
}) {
  const { id: boardId, role } = useBoard();
  const canEdit = role !== null;
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(null);
    setError(null);
    if (!saved) return;
    let cancelled = false;
    loadAttachments(ticketId)
      .then((loaded) => { if (!cancelled) setItems(loaded); })
      .catch((failure) => { console.error(failure); if (!cancelled) setError("Couldn't load the attachments."); });
    return () => { cancelled = true; };
  }, [ticketId, saved]);

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const problem = attachmentProblem(file);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      const added = await addAttachment(boardId, ticketId, file);
      setItems((current) => [...(current ?? []), added]);
      trackEvent("attachment_added", { board_id: boardId });
    } catch (failure) {
      console.error(failure);
      setError(failure instanceof Error && failure.message ? `Couldn't attach that file. ${failure.message}` : "Couldn't attach that file.");
    } finally {
      setBusy(false);
    }
  };

  const open = async (attachment: Attachment) => {
    // The tab opens first, inside the click, so the browser doesn't treat it as a pop-up.
    const tab = window.open("", "_blank");
    if (!tab) { setError("Your browser blocked the new tab. Allow pop-ups for this site to open attachments."); return; }
    try {
      const link = await attachmentLink(attachment.path);
      tab.opener = null;
      tab.location.href = link;
    } catch (failure) {
      console.error(failure);
      tab.close();
      setError("Couldn't open that attachment.");
    }
  };

  const remove = async (attachment: Attachment) => {
    if (!window.confirm(`Remove ${attachment.name}? This can't be undone.`)) return;
    setError(null);
    try {
      await removeAttachment(attachment);
      setItems((current) => (current ?? []).filter((item) => item.id !== attachment.id));
      trackEvent("attachment_removed", { board_id: boardId });
    } catch (failure) {
      console.error(failure);
      setError("Couldn't remove that attachment.");
    }
  };

  return (
    <div className="attachments">
      {saved && items === null && !error && <span className="attachments-muted">Loading…</span>}
      {items?.map((attachment) => (
        <div className="attachment" key={attachment.id}>
          <button type="button" className="attachment-open" onClick={() => open(attachment)} title="Open in a new tab">
            <FileText size={13} aria-hidden="true" />
            <span className="attachment-name">{attachment.name}</span>
            <span className="attachments-muted">{sizeLabel(attachment.size)}</span>
          </button>
          {canEdit && <button type="button" className="attachment-remove" aria-label={`Remove ${attachment.name}`} onClick={() => remove(attachment)}><X size={12} /></button>}
        </div>
      ))}
      {saved && items?.length === 0 && <span className="attachments-muted">No attachments yet.</span>}
      {!saved && <span className="attachments-muted">You can attach files once the ticket has saved.</span>}
      {canEdit && saved && (
        <>
          <button type="button" className="place-add attachment-add" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Paperclip size={11} aria-hidden="true" /> {busy ? "Uploading…" : "Attach a file"}
          </button>
          <input ref={fileRef} type="file" accept={ATTACHMENT_ACCEPT} hidden onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
          <span className="attachments-muted">{ATTACHMENT_KINDS}, up to {MAX_ATTACHMENT_BYTES / 1024 / 1024} MB. Only staff of this board can see attachments.</span>
        </>
      )}
      {error && <p className="attachments-error" role="alert">{error}</p>}
    </div>
  );
}
