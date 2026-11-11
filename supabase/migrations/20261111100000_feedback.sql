-- A searchable copy of what the portal footer's Contact us form sends (WA-223). ADDITIVE: one table.
--
-- The form also posts to Netlify Forms, which emails the team; this table is the backup and the record. The
-- app treats a message as sent if either one worked, so it does not depend on this migration being applied.
--
-- Who can do what: a signed-in user adds a row as themselves, for a board they belong to (or none); only platform
-- admins read or delete rows. Staff cannot read feedback, not even their own. anon has no access. No email address
-- is stored: user_id says who sent it, and the sender's address is in the Netlify email.

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  board      text references public.boards (id) on delete set null,
  kind       text not null check (kind in ('bug', 'feature', 'feedback')),
  message    text not null check (length(btrim(message)) > 0 and length(message) <= 2000),
  -- The portal page it was sent from (path only, never a share token).
  page       text check (length(page) <= 300),
  user_id    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_at on public.feedback (created_at desc);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon;

drop policy if exists "feedback insert" on public.feedback;
drop policy if exists "feedback select" on public.feedback;
drop policy if exists "feedback delete" on public.feedback;
create policy "feedback insert" on public.feedback for insert to authenticated
  with check (user_id = auth.uid() and (board is null or public.is_board_member(board) or public.is_platform_admin()));
create policy "feedback select" on public.feedback for select to authenticated
  using (public.is_platform_admin());
create policy "feedback delete" on public.feedback for delete to authenticated
  using (public.is_platform_admin());
