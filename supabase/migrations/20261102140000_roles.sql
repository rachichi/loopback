-- Roles: platform admin (platform_admins), staff and volunteer (board_members.role).
--   Platform admin: every board. Read, create, edit and delete tickets; manage boards, flags and members.
--   Staff:          their own board. Read, create, edit and delete tickets.
--   Volunteer:      their own board. Read only.
-- The legacy board role 'admin' is treated as staff until a later migration converts those rows.
--
-- ADDITIVE and safe with the live app: the role check only widens, and every user who can write tickets
-- today (admin or staff) still can. Platform admins gain ticket access on every board. The "demo" policies
-- are untouched (migration 3b drops them).

-- 1. Allow the volunteer role.
alter table public.board_members drop constraint if exists board_members_role_check;
alter table public.board_members add constraint board_members_role_check
  check (role in ('admin', 'staff', 'volunteer'));

-- 2. Who may write a board's tickets.
create or replace function public.can_edit_board(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (select 1 from public.board_members
                 where user_id = auth.uid() and board_id = b and role in ('admin', 'staff'))
$$;

-- 3. Ticket policies. Volunteers keep select through is_board_member; writes need can_edit_board.
drop policy if exists "tickets select" on public.tickets;
drop policy if exists "tickets insert" on public.tickets;
drop policy if exists "tickets update" on public.tickets;
drop policy if exists "tickets delete" on public.tickets;
create policy "tickets select" on public.tickets for select to authenticated
  using (public.is_board_member(board) or public.is_platform_admin());
create policy "tickets insert" on public.tickets for insert to authenticated
  with check (public.can_edit_board(board));
create policy "tickets update" on public.tickets for update to authenticated
  using (public.can_edit_board(board)) with check (public.can_edit_board(board));
create policy "tickets delete" on public.tickets for delete to authenticated
  using (public.can_edit_board(board));
