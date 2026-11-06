-- Meetings tab (meetings_tab flag): a committee per meeting, AI-drafted minutes stored on the meeting,
-- and a way for staff to save edits to the minutes. All additive.
--
-- Minutes are written once by the generate-minutes Edge Function (service role). Staff edit them through
-- save_meeting_minutes, because writes to public.meetings are otherwise platform-admin only.

alter table public.meetings
  add column if not exists committee text,
  add column if not exists minutes_html text,
  add column if not exists minutes_md text,
  add column if not exists minutes_generated_at timestamptz,
  add column if not exists minutes_edited_at timestamptz;

-- Backfill the committee from the title: "Youth and Education Committee Meeting" -> "Youth and Education".
update public.meetings
set committee = case
  when title ~* '\mCommittee\M' then nullif(btrim(regexp_replace(regexp_replace(title, '\s+Committee\M.*$', '', 'i'), '\s+(Part\s+\d+)\s*$', '', 'i')), '')
  when title ~* '^Full Board' then 'Full Board'
  else null
end
where committee is null;

create or replace function public.save_meeting_minutes(m uuid, html text) returns void
language plpgsql security definer set search_path = public as $$
declare
  b text;
begin
  select board into b from public.meetings where id = m;
  if b is null or not public.can_edit_board(b) then
    raise exception 'Not allowed to edit minutes for this meeting.' using errcode = '42501';
  end if;
  update public.meetings
  set minutes_html = html, minutes_edited_at = now()
  where id = m and minutes_generated_at is not null;
end $$;

revoke all on function public.save_meeting_minutes(uuid, text) from public, anon;
grant execute on function public.save_meeting_minutes(uuid, text) to authenticated;

insert into public.feature_flags (key, description, default_enabled, requires_board_setup) values
  ('meetings_tab', 'Meetings tab: transcript, meeting tickets and AI-drafted minutes (V2)', false, false)
on conflict (key) do nothing;
