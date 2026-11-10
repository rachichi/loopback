-- Pinned Meetings folders (WA-218). ADDITIVE: one column and CB9's pins.
--
-- boards.pinned_meeting_folders lists folders the Meetings tab keeps at the top, in that order, with a pin
-- icon shown on hover. The first pinned folder is the upload default. Other folders follow in the order of
-- boards.meeting_folders. Names that are not in meeting_folders are ignored.

alter table public.boards
  add column if not exists pinned_meeting_folders jsonb not null default '[]';

update public.boards
set pinned_meeting_folders = '["District Service Cabinet", "General Board"]'::jsonb
where id in ('b-cb-9', 'staging');
