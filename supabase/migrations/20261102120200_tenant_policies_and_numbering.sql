-- Migration 3a of 3b: tenant policies, server-side numbering, metrics views. ADDITIVE.
-- Safe with the current client: the existing "demo" policies stay in place until migration 3b, and the
-- numbering trigger only acts on rows inserted with number <= 0 (the old client sends real numbers).
-- Run this BEFORE deploying the new client. Run 20261102120300_drop_demo_policies.sql AFTER it.

-- 0. Pin search_path on trigger functions (Supabase advisor: function_search_path_mutable).
alter function public.set_closed_at()    set search_path = public;
alter function public.touch_updated_at() set search_path = public;

alter table public.tickets alter column created_by set default auth.uid();

-- 1. Server-side ticket numbers.
-- The new client sends number = 0 for a NEW ticket. Existing tickets keep their number, so an upsert of an
-- existing row is never renumbered. The client must insert new tickets and update existing ones
-- separately (see section 7 of the spec); a mixed upsert would still consume a counter value.
create or replace function public.assign_ticket_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.number is null or new.number <= 0 then
    update public.boards set next_ticket_no = next_ticket_no + 1
      where id = new.board
      returning next_ticket_no - 1 into new.number;
    if new.number is null then
      raise exception 'unknown board %', new.board;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tickets_number on public.tickets;
create trigger tickets_number before insert on public.tickets
  for each row execute function public.assign_ticket_number();

-- 2. Helpers
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

create or replace function public.is_board_member(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_members where user_id = auth.uid() and board_id = b)
$$;

create or replace function public.is_board_admin(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_members where user_id = auth.uid() and board_id = b and role = 'admin')
$$;

-- 3. Policies for signed-in users. Anonymous access is untouched here (see 3b).
drop policy if exists "tickets select" on public.tickets;
drop policy if exists "tickets insert" on public.tickets;
drop policy if exists "tickets update" on public.tickets;
drop policy if exists "tickets delete" on public.tickets;
create policy "tickets select" on public.tickets for select to authenticated
  using (public.is_board_member(board));
create policy "tickets insert" on public.tickets for insert to authenticated
  with check (public.is_board_member(board));
create policy "tickets update" on public.tickets for update to authenticated
  using (public.is_board_member(board)) with check (public.is_board_member(board));
create policy "tickets delete" on public.tickets for delete to authenticated
  using (public.is_board_admin(board));

drop policy if exists "boards select" on public.boards;
drop policy if exists "boards insert" on public.boards;
drop policy if exists "boards update" on public.boards;
create policy "boards select" on public.boards for select to authenticated
  using (public.is_board_member(id) or public.is_platform_admin());
create policy "boards insert" on public.boards for insert to authenticated
  with check (public.is_platform_admin());
create policy "boards update" on public.boards for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "members select" on public.board_members;
drop policy if exists "members write"  on public.board_members;
create policy "members select" on public.board_members for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());
create policy "members write" on public.board_members for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "platform admins select own" on public.platform_admins;
create policy "platform admins select own" on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "flags select" on public.feature_flags;
drop policy if exists "flags write"  on public.feature_flags;
create policy "flags select" on public.feature_flags for select to authenticated
  using (true);
create policy "flags write" on public.feature_flags for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 4. Metrics. security_invoker makes the views obey the caller's RLS (views bypass RLS by default).
create or replace view public.board_ticket_metrics with (security_invoker = true) as
select
  board,
  count(*) filter (where status <> 'Closed')                                  as open_count,
  count(*) filter (where status = 'Open')                                     as status_open,
  count(*) filter (where status = 'In Progress')                              as status_in_progress,
  count(*) filter (where status = 'Closed')                                   as status_closed,
  count(*) filter (where deadline < current_date and status <> 'Closed')      as overdue_count,
  percentile_cont(0.5) within group (order by (closed_at::date - submitted_at))
    filter (where closed_at is not null)                                      as median_days_to_close,
  percentile_cont(0.5) within group (order by (current_date - submitted_at))
    filter (where status <> 'Closed')                                         as median_open_age_days,
  max(current_date - submitted_at) filter (where status <> 'Closed')          as max_open_age_days
from public.tickets
group by board;

create or replace view public.board_ticket_counts with (security_invoker = true) as
select board, type, source, status, count(*) as n
from public.tickets
group by board, type, source, status;

grant select on public.board_ticket_metrics, public.board_ticket_counts, public.board_effective_features
  to authenticated;
