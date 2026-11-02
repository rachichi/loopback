-- The people a ticket can be assigned to (tickets.owner_id), for the Owner column (spec section 6.2).
-- ADDITIVE. board_members only shows a user their own rows and emails live in auth.users, so the app
-- reads this function instead. It lists the board's staff with their email, and only to the board's
-- staff and platform admins.

create or replace function public.board_staff(b text)
returns table (user_id uuid, email text, role text)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, u.email::text, m.role
  from public.board_members m
  join auth.users u on u.id = m.user_id
  where m.board_id = b
    and (public.is_board_member(b) or public.is_platform_admin())
  order by u.email
$$;

revoke all on function public.board_staff(text) from public, anon;
grant execute on function public.board_staff(text) to authenticated;
