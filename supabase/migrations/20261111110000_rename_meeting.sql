-- Lets staff rename a meeting from the Meetings tab. ADDITIVE: one function.
--
-- Writes to public.meetings are platform-admin only, so staff rename through this function, which checks
-- can_edit_board on the meeting's board and touches only meetings.title.

create or replace function public.rename_meeting(m uuid, t text) returns void
language plpgsql security definer set search_path = public as $$
declare
  meeting_board text;
begin
  select board into meeting_board from public.meetings where id = m;
  if meeting_board is null or not public.can_edit_board(meeting_board) then
    raise exception 'Not allowed to rename this meeting.' using errcode = '42501';
  end if;
  if t is null or btrim(t) = '' then
    raise exception 'A meeting needs a title.' using errcode = '22023';
  end if;
  update public.meetings set title = btrim(t) where id = m;
end $$;

revoke all on function public.rename_meeting(uuid, text) from public, anon;
grant execute on function public.rename_meeting(uuid, text) to authenticated;
