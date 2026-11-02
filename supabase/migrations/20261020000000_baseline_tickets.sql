-- Loopback tickets. Paste into the Supabase SQL editor (Database → SQL editor) and run once.
-- Meeting transcripts are not stored here; they're bundled with the app until the Block Party API is wired in.

create table if not exists public.tickets (
  id            text primary key,
  board         text not null,                 -- community board, e.g. 'b-cb-9'; see 002_board.sql
  number        integer not null,
  title         text not null,
  type          text not null default 'Other',
  status        text not null default 'Open',
  urgent        boolean not null default false,
  deadline      date,
  location_text text not null default '',
  places        jsonb not null default '[]',   -- [{ name, lat, lng, source }]
  requester     text not null default '',
  summary       text not null default '',
  submitted_by  text not null,
  submitted_at  date not null default current_date,
  meeting_ids   text[] not null default '{}',  -- meetings where the issue was discussed, oldest first
  spans         jsonb not null default '[]',   -- transcript highlights: [{ meetingId, start, end }]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tickets_board_number on public.tickets (board, number);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tickets_touch on public.tickets;
create trigger tickets_touch before update on public.tickets
  for each row execute function public.touch_updated_at();

-- The app talks to Supabase with the public (anon) key, so row-level security decides who can do what.
-- DEMO ONLY: these policies let anyone with the app's URL read, add and edit tickets.
-- Replace them with authenticated-user policies before real constituent data goes in.
alter table public.tickets enable row level security;
drop policy if exists "demo read" on public.tickets;
drop policy if exists "demo insert" on public.tickets;
drop policy if exists "demo update" on public.tickets;
create policy "demo read" on public.tickets for select to anon using (true);
create policy "demo insert" on public.tickets for insert to anon with check (true);
create policy "demo update" on public.tickets for update to anon using (true) with check (true);
