-- Tag every ticket with the community board it belongs to: 'm-cb-3' (Manhattan CB3), 'b-cb-9' (Brooklyn CB9), …
-- All boards share the tickets table; each deployment of the app only loads and saves its own board's tickets.
-- Run once in the Supabase SQL editor, after schema.sql.
alter table public.tickets add column if not exists board text;
-- The tickets so far are all from Manhattan CB3's meetings.
update public.tickets set board = 'm-cb-3' where board is null;
alter table public.tickets alter column board set not null;
create index if not exists tickets_board_number on public.tickets (board, number);
