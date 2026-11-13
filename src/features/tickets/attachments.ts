// File attachments on tickets (PDFs, photos, common documents). Files are in the private Storage bucket `ticket-files` (<board>/<ticket>/<id>.<ext>)
// and listed in ticket_attachments. RLS decides who can read, add and delete; nothing here is public.
import { db } from "../../db";

const BUCKET = "ticket-files";
/** The bucket enforces the same limit; this just fails fast with a clear message. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** The file types that can be attached, by extension. Must match the bucket's allowed_mime_types. HTML and SVG are
 *  left out on purpose: opened from a link they can run scripts. */
const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain", csv: "text/csv",
};
/** For the file picker's accept attribute. Phones then offer the camera and photo library. */
export const ATTACHMENT_ACCEPT = ["image/*", ...Object.keys(FILE_TYPES).map((ext) => `.${ext}`)].join(",");
/** For help text. */
export const ATTACHMENT_KINDS = "PDFs, photos, Word and Excel files, text and CSV";

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

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
  if (!FILE_TYPES[extensionOf(file.name)]) return `That file type can't be attached. Use ${ATTACHMENT_KINDS}.`;
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_ATTACHMENT_BYTES) return `That file is over ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`;
  return null;
}

/** Uploads a file and records it. If recording fails the upload is removed, so no file is left unlisted. */
export async function addAttachment(board: string, ticketId: string, file: File): Promise<Attachment> {
  const problem = attachmentProblem(file);
  if (problem) throw new Error(problem);
  const id = crypto.randomUUID();
  const ext = extensionOf(file.name);
  const path = `${board}/${ticketId}/${id}.${ext}`;
  // The type comes from the extension, not the browser: some report HEIC photos as "" or application/octet-stream.
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, { contentType: FILE_TYPES[ext], upsert: false });
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
