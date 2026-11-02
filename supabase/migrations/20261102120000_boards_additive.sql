-- Migration 1 of 3: additive only. Safe to run while the current app is live.
-- Adds multi-board tables, new ticket columns, a keep-alive function, and the closed_at trigger.
-- Does NOT change any existing policy or constraint. Run 20261102120200 only after the new client ships.

create table if not exists public.boards (
  id               text primary key,                 -- 'm-cb-3', 'b-cb-9'; matches tickets.board
  name             text not null,
  borough          text not null,
  logo_url         text,
  boundary_geojson jsonb,                            -- GeoJSON FeatureCollection; null falls back to NYC bounds
  ticket_types     jsonb not null default '[]',      -- [{ label, css_class, definition }]
  features         jsonb not null default '{"manual_intake": true, "district_map": true}',
  next_ticket_no   integer not null default 1,
  created_at       timestamptz not null default now()
);

create table if not exists public.board_members (
  user_id  uuid not null references auth.users on delete cascade,
  board_id text not null references public.boards on delete cascade,
  role     text not null check (role in ('admin', 'staff')),
  primary key (user_id, board_id)
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users on delete cascade
);

-- New tables start locked: RLS on, no policies, so only the SQL editor (postgres role) can touch them
-- until migration 3 adds policies.
alter table public.boards          enable row level security;
alter table public.board_members   enable row level security;
alter table public.platform_admins enable row level security;

alter table public.tickets
  add column if not exists source     text not null default 'manual' check (source in ('manual', 'transcript', 'email')),
  add column if not exists closed_at  timestamptz,
  add column if not exists created_by uuid references auth.users,
  add column if not exists owner_id   uuid references auth.users;

-- Backfill closed_at for tickets that are already closed.
update public.tickets set closed_at = updated_at where status = 'Closed' and closed_at is null;

create or replace function public.set_closed_at() returns trigger language plpgsql as $$
begin
  if new.status = 'Closed' and (tg_op = 'INSERT' or old.status is distinct from 'Closed') then
    new.closed_at = coalesce(new.closed_at, now());
  elsif new.status <> 'Closed' then
    new.closed_at = null;
  end if;
  return new;
end $$;

drop trigger if exists tickets_closed_at on public.tickets;
create trigger tickets_closed_at before insert or update on public.tickets
  for each row execute function public.set_closed_at();

-- Keep-alive target for the GitHub Action. Returns only true, exposes no data, touches a table so the
-- request registers as database activity. security definer so it keeps working after RLS is tightened.
create or replace function public.ping() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.boards)
$$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
