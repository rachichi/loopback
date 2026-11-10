// PDF attachments on tickets. Files are in the private Storage bucket `ticket-files` (<board>/<ticket>/<id>.pdf)
// and listed in ticket_attachments. RLS decides who can read, add and delete; nothing here is public.
import { db } from "../../db";

const BUCKET = "ticket-files";
/** The bucket enforces the same limit; this just fails fast with a clear message. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type Attachment = { id: string; ticketId: string; path: string; name: string; size: number; createdAt: string };

type AttachmentRow = { id: string; ticket_id: string; path: string; name: string; size_bytes: number; created_at: string };
const fromRow = (row: AttachmentRow): Attachment => ({ id: row.id, ticketId: row.ticket_id, path: row.path, name: row.name, size: row.size_bytes, createdAt: row.created_at });

export async function loadAttachments(ticketId: string): Promise<Attachment[]> {
  const { data, error } = await db.from("ticket_attachments").select("id, ticket_id, path, name, size_bytes, created_at").eq("ticket_id", ticketId).order("created_at");
  if (error) throw error;
  return ((data ?? []) as AttachmentRow[]).map(fromRow);
}

/** A reason this file can't be attached, or null if it can. */
export function attachmentProblem(file: File): string | null {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return "Only PDF files can be attached.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_ATTACHMENT_BYTES) return `That file is over ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`;
  return null;
}

/** Uploads a PDF and records it. If recording fails the upload is removed, so no file is left unlisted. */
export async function addAttachment(board: string, ticketId: string, file: File): Promise<Attachment> {
  const problem = attachmentProblem(file);
  if (problem) throw new Error(problem);
  const id = crypto.randomUUID();
  const path = `${board}/${ticketId}/${id}.pdf`;
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await db
    .from("ticket_attachments")
    .insert({ id, board, ticket_id: ticketId, path, name: file.name, size_bytes: file.size })
    .select("id, ticket_id, path, name, size_bytes, created_at")
    .single();
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return fromRow(data as AttachmentRow);
}

/** Deletes the record, then the file. A file that fails to delete is left unlisted, which is harmless. */
export async function removeAttachment(attachment: Attachment): Promise<void> {
  const { error } = await db.from("ticket_attachments").delete().eq("id", attachment.id);
  if (error) throw error;
  const { error: storageError } = await db.storage.from(BUCKET).remove([attachment.path]);
  if (storageError) console.error("Couldn't remove an attachment's file", storageError);
}

/** A link that works for one minute. Files are private, so there is no permanent address. */
export async function attachmentLink(path: string): Promise<string> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

/** The storage paths of these tickets' attachments, by ticket id. Read before the tickets are deleted. */
export async function attachmentPaths(ticketIds: string[]): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>();
  if (!ticketIds.length) return found;
  const { data, error } = await db.from("ticket_attachments").select("ticket_id, path").in("ticket_id", ticketIds);
  if (error) throw error;
  for (const row of (data ?? []) as { ticket_id: string; path: string }[]) found.set(row.ticket_id, [...(found.get(row.ticket_id) ?? []), row.path]);
  return found;
}

/** Removes files from Storage. Failures are logged, not thrown: the tickets they belonged to are already gone. */
export async function removeFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await db.storage.from(BUCKET).remove(paths);
  if (error) console.error("Couldn't remove deleted tickets' files", error);
}
