-- Attachments: allow photos and common documents as well as PDFs. ADDITIVE: only widens the bucket's allow-list.
--
-- Constituents send pictures. The bucket `ticket-files` stays private and keeps its 10 MB limit. The allow-list
-- is still a list, not "everything": HTML, SVG and scripts are left out because they can run code when opened
-- from a link. Table, RLS and storage policies are unchanged; they never looked at the file type.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
]
where id = 'ticket-files';
