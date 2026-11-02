-- Public read-only share links, and removal of the volunteer role.
--
-- Anyone with a board's share link sees that board's tickets, limited to fields chosen to carry no
-- personal details: number, title, type, status, urgent, deadline, location (text and map places) and
-- submitted date. Requester, summary, submitted_by, meeting ids, transcript spans, created_by and
-- owner_id are never exposed.
--
-- The tables stay closed to anon. The public reads only through two security definer functions that
-- take the share token and return the allowed columns. This replaces "no anon access in V1" with
-- "no anon access to any table in V1" (spec section 5).
--
-- Each board gets a random token now. Staff and platform admins can replace it (rotate_share_token),
-- which stops every old link at once. A null token means the board has no working public link.

-- 1. Share tokens. 18 random bytes, base64url without padding (24 characters).
alter table public.boards add column if not exists share_token text unique;

create or replace function public.new_share_token() returns text
language sql volatile set search_path = public, extensions as $$
  select replace(translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), '=', '')
$$;
revoke all on function public.new_share_token() from public, anon, authenticated;

update public.boards set share_token = public.new_share_token() where share_token is null;

-- 2. Staff and platform admins replace their board's link. Returns the new token.
create or replace function public.rotate_share_token(b text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  token text;
begin
  if not public.can_edit_board(b) then
    raise exception 'Only staff can change this board''s share link.' using errcode = '42501';
  end if;
  token := public.new_share_token();
  update public.boards set share_token = token where id = b;
  return token;
end $$;
revoke all on function public.rotate_share_token(text) from public, anon;
grant execute on function public.rotate_share_token(text) to authenticated;

-- 3. What the public link can read. Short or empty tokens never match.
create or replace function public.public_board(token text)
returns table (id text, name text, borough text, logo_url text, background_url text, boundary_geojson jsonb, ticket_types jsonb)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.borough, b.logo_url, b.background_url, b.boundary_geojson, b.ticket_types
  from public.boards b
  where length(token) >= 20 and b.share_token = token
$$;

create or replace function public.public_board_tickets(token text)
returns table (id text, number integer, title text, type text, status text, urgent boolean, deadline date,
               location_text text, places jsonb, submitted_at date)
language sql stable security definer set search_path = public as $$
  select t.id, t.number, t.title, t.type, t.status, t.urgent, t.deadline, t.location_text, t.places, t.submitted_at
  from public.tickets t
  join public.boards b on b.id = t.board
  where length(token) >= 20 and b.share_token = token
  order by t.number
$$;

revoke all on function public.public_board(text), public.public_board_tickets(text) from public;
grant execute on function public.public_board(text), public.public_board_tickets(text) to anon, authenticated;

-- 4. Remove the volunteer role. No rows used it (checked 2026-11-02); the delete is a guard.
delete from public.board_members where role = 'volunteer';
alter table public.board_members drop constraint if exists board_members_role_check;
alter table public.board_members add constraint board_members_role_check check (role in ('admin', 'staff'));

-- 5. The email lookup for volunteer invites is no longer used.
drop function if exists public.user_id_by_email(text);
