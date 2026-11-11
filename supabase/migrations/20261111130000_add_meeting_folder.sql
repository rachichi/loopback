-- Lets staff add a Meetings folder to their board. ADDITIVE: one function.
--
-- Writes to public.boards are platform-admin only, so staff add folders through this function, which checks
-- can_edit_board and only appends to boards.meeting_folders. Adding a name the board already has does nothing.

create or replace function public.add_meeting_folder(b text, f text) returns void
language plpgsql security definer set search_path = public as $$
declare
  folder_name text := btrim(f);
begin
  if not public.can_edit_board(b) then
    raise exception 'Not allowed to change this board''s folders.' using errcode = '42501';
  end if;
  if folder_name is null or folder_name = '' or length(folder_name) > 80 then
    raise exception 'A folder needs a name of 1 to 80 characters.' using errcode = '22023';
  end if;
  update public.boards
  set meeting_folders = meeting_folders || to_jsonb(folder_name)
  where id = b and not exists (select 1 from jsonb_array_elements_text(meeting_folders) e where lower(e) = lower(folder_name));
end $$;

revoke all on function public.add_meeting_folder(text, text) from public, anon;
grant execute on function public.add_meeting_folder(text, text) to authenticated;
