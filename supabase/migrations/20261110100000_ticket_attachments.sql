-- PDF attachments on tickets (WA-210). ADDITIVE: one private Storage bucket, one table, their policies.
--
-- Files live in the private bucket `ticket-files` as <board id>/<ticket id>/<attachment id>.pdf. Nothing here
-- is public: staff of the board and platform admins can read a file (through a short-lived signed link the app
-- asks for), staff can add and delete, everyone else, and anon, gets nothing. The share-link functions
-- (public_board, public_board_tickets) return a fixed list of columns and do not touch this table.
--
-- Limits are enforced by the bucket, not just the app: PDFs only, 10 MB each.
--
-- ticket_attachments rows cascade when their ticket is deleted. The files do not (Storage is not SQL), so the
-- app removes a deleted ticket's files itself.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-files', 'ticket-files', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create table if not exists public.ticket_attachments (
  id         uuid primary key default gen_random_uuid(),
  board      text not null references public.boards (id),
  ticket_id  text not null references public.tickets (id) on delete cascade,
  -- Storage object name inside ticket-files: <board>/<ticket>/<id>.pdf
  path       text not null unique,
  -- The file's name as uploaded, shown to staff. Not used in the path.
  name       text not null check (length(btrim(name)) > 0),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists ticket_attachments_ticket on public.ticket_attachments (ticket_id);

alter table public.ticket_attachments enable row level security;
revoke all on public.ticket_attachments from anon;

drop policy if exists "attachments select" on public.ticket_attachments;
drop policy if exists "attachments insert" on public.ticket_attachments;
drop policy if exists "attachments delete" on public.ticket_attachments;
create policy "attachments select" on public.ticket_attachments for select to authenticated
  using (public.is_board_member(board) or public.is_platform_admin());
-- The ticket must be on the same board, and the path must sit under that board and ticket.
create policy "attachments insert" on public.ticket_attachments for insert to authenticated
  with check (
    public.can_edit_board(board)
    and exists (select 1 from public.tickets t where t.id = ticket_id and t.board = ticket_attachments.board)
    and path like board || '/' || ticket_id || '/%'
  );
create policy "attachments delete" on public.ticket_attachments for delete to authenticated
  using (public.can_edit_board(board));

-- Storage: the first folder of an object name is the board id.
drop policy if exists "ticket files read" on storage.objects;
drop policy if exists "ticket files insert" on storage.objects;
drop policy if exists "ticket files delete" on storage.objects;
create policy "ticket files read" on storage.objects for select to authenticated
  using (bucket_id = 'ticket-files' and (public.is_board_member((storage.foldername(name))[1]) or public.is_platform_admin()));
create policy "ticket files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-files' and public.can_edit_board((storage.foldername(name))[1]));
create policy "ticket files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'ticket-files' and public.can_edit_board((storage.foldername(name))[1]));
