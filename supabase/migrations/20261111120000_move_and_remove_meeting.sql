-- Lets staff move a meeting to another Meetings folder and remove a meeting. ADDITIVE: two functions.
--
-- Writes to public.meetings are platform-admin only, so staff go through these, which check can_edit_board
-- on the meeting's board. Removing a meeting deletes its pending and decided suggestions (the foreign key
-- cascades), and takes the meeting out of the tickets that were discussed in it: its id leaves
-- tickets.meeting_ids and its highlights leave tickets.spans. The tickets themselves stay.

create or replace function public.move_meeting(m uuid, f text) returns void
language plpgsql security definer set search_path = public as $$
declare
  meeting_board text;
begin
  select board into meeting_board from public.meetings where id = m;
  if meeting_board is null or not public.can_edit_board(meeting_board) then
    raise exception 'Not allowed to move this meeting.' using errcode = '42501';
  end if;
  if f is null or btrim(f) = '' then
    raise exception 'A folder needs a name.' using errcode = '22023';
  end if;
  update public.meetings set folder = btrim(f) where id = m;
end $$;

create or replace function public.remove_meeting(m uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  meeting_board text;
begin
  select board into meeting_board from public.meetings where id = m;
  if meeting_board is null or not public.can_edit_board(meeting_board) then
    raise exception 'Not allowed to remove this meeting.' using errcode = '42501';
  end if;
  update public.tickets
  set meeting_ids = array_remove(meeting_ids, m::text),
      spans = coalesce((select jsonb_agg(s) from jsonb_array_elements(spans) s where s ->> 'meetingId' <> m::text), '[]'::jsonb)
  where board = meeting_board and (m::text = any (meeting_ids) or spans @> jsonb_build_array(jsonb_build_object('meetingId', m::text)));
  delete from public.meetings where id = m;
end $$;

revoke all on function public.move_meeting(uuid, text) from public, anon;
revoke all on function public.remove_meeting(uuid) from public, anon;
grant execute on function public.move_meeting(uuid, text) to authenticated;
grant execute on function public.remove_meeting(uuid) to authenticated;
