-- Lets staff pin and unpin Meetings folders (WA-218). ADDITIVE: one function.
--
-- Writes to public.boards are platform-admin only, so staff change the pins through this function, which
-- checks can_edit_board and touches only boards.pinned_meeting_folders. Pins must be a JSON array of text.

create or replace function public.set_pinned_meeting_folders(b text, pins jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_board(b) then
    raise exception 'Not allowed to change this board''s folders.' using errcode = '42501';
  end if;
  if jsonb_typeof(pins) <> 'array' or exists (select 1 from jsonb_array_elements(pins) e where jsonb_typeof(e) <> 'string') then
    raise exception 'Pinned folders must be a list of names.' using errcode = '22023';
  end if;
  update public.boards set pinned_meeting_folders = pins where id = b;
end $$;

revoke all on function public.set_pinned_meeting_folders(text, jsonb) from public, anon;
grant execute on function public.set_pinned_meeting_folders(text, jsonb) to authenticated;
