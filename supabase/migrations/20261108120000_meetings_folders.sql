-- Meeting folders and staff transcript upload (WA-218). ADDITIVE: one column and one function.
--
-- folder groups meetings on the Meetings tab: committee recordings (including ULURP) share 'Committee',
-- Dante's internal Zoom meetings go in 'District Service Cabinet'. A plain text column, so a board can
-- add a folder by using a new name. Existing meetings stay in 'Committee'.
--
-- Writes to public.meetings are platform-admin only, so staff add a meeting through add_meeting,
-- which checks can_edit_board and always files it as source 'upload'.

alter table public.meetings
  add column if not exists folder text not null default 'Committee';

create or replace function public.add_meeting(b text, t text, d date, f text, body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if not public.can_edit_board(b) then
    raise exception 'Not allowed to add meetings to this board.' using errcode = '42501';
  end if;
  if btrim(coalesce(t, '')) = '' or btrim(coalesce(body, '')) = '' then
    raise exception 'A meeting needs a title and a transcript.' using errcode = '22023';
  end if;
  insert into public.meetings (board, title, held_on, transcript, source, folder)
  values (b, btrim(t), d, body, 'upload', coalesce(nullif(btrim(f), ''), 'Committee'))
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.add_meeting(text, text, date, text, text) from public, anon;
grant execute on function public.add_meeting(text, text, date, text, text) to authenticated;
