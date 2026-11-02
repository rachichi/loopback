-- Migration 3b: remove anonymous access. BREAKING for any client that is not signed in.
-- Run only AFTER the new client (sign-in + BoardProvider) is deployed and a staff user can sign in.
--
-- Pre-check, must return no rows:
--   select board, number, count(*) from public.tickets group by 1, 2 having count(*) > 1;

alter table public.tickets
  add constraint tickets_board_fk foreign key (board) references public.boards (id),
  add constraint tickets_board_number_uq unique (board, number);

drop policy if exists "demo read"   on public.tickets;
drop policy if exists "demo insert" on public.tickets;
drop policy if exists "demo update" on public.tickets;
