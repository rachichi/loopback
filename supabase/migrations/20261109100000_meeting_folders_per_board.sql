-- Per-board Meetings folders (WA-218). ADDITIVE: one column, and CB9's list.
--
-- boards.meeting_folders is the ordered list of folder names the Meetings tab shows (all of them, even
-- empty ones) and offers in the Upload transcript form. The first is the default. An empty list means
-- the board has no folders of its own and the tab shows the folders its meetings already use.
-- Brooklyn CB9 (and staging, which mirrors it) get the district's committees, with District Service
-- Cabinet first because it is the default for uploads.

alter table public.boards
  add column if not exists meeting_folders jsonb not null default '[]';

update public.boards
set meeting_folders = '["District Service Cabinet", "Economic Development", "Education & Library", "Environmental Protection", "Executive", "General Board", "Health & Social Services", "Housing", "Parks, Recreation, & Culture", "Public Safety", "Youth Services", "Transportation", "ULURP/Land Use", "Special Meetings/Info Sessions/Nominations Committee"]'::jsonb
where id in ('b-cb-9', 'staging');

-- File the meetings those boards already have by title. A title that matches nothing keeps its
-- folder ('Committee'), which the tab still shows. Youth and Education goes to Education & Library.
update public.meetings
set folder = case
  when title ~* 'ULURP|Land Use'                         then 'ULURP/Land Use'
  when title ~* 'Economic Development'                    then 'Economic Development'
  when title ~* 'Youth Services'                          then 'Youth Services'
  when title ~* 'Education|Library'                       then 'Education & Library'
  when title ~* 'Environmental'                           then 'Environmental Protection'
  when title ~* '^Executive'                              then 'Executive'
  when title ~* 'General Board|Full Board'                then 'General Board'
  when title ~* 'Health|Social Services'                  then 'Health & Social Services'
  when title ~* 'Housing'                                 then 'Housing'
  when title ~* 'Parks|Recreation|Culture'                then 'Parks, Recreation, & Culture'
  when title ~* 'Public Safety'                           then 'Public Safety'
  when title ~* 'Transportation'                          then 'Transportation'
  when title ~* 'Statement of Needs|Info Session|Nomination|Special' then 'Special Meetings/Info Sessions/Nominations Committee'
  else folder
end
where board in ('b-cb-9', 'staging') and folder = 'Committee';
