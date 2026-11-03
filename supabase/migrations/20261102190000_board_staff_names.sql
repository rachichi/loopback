-- The board's staff with their display name, so the Owner column can show names instead of emails.
-- ADDITIVE. Same as board_staff() plus a name column, read from auth user metadata (full_name, set by
-- supabase/scripts/set_staff_names.sql). A new function because create or replace cannot change the
-- result columns of board_staff(). Drop board_staff() in a later migration once nothing calls it.

create or replace function public.board_staff_named(b text)
returns table (user_id uuid, email text, name text, role text)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, u.email::text, nullif(trim(u.raw_user_meta_data->>'full_name'), ''), m.role
  from public.board_members m
  join auth.users u on u.id = m.user_id
  where m.board_id = b
    and (public.is_board_member(b) or public.is_platform_admin())
  order by coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), u.email)
$$;

revoke all on function public.board_staff_named(text) from public, anon;
grant execute on function public.board_staff_named(text) to authenticated;
