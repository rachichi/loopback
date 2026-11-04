-- Sets the display name (auth user metadata full_name) shown on the home page and in the Owner column.
-- NOT a migration. Paste into the Supabase SQL editor and run. Safe to re-run.
--
-- Plus-addressed accounts get the name of their base address, so the per-board test staff accounts from
-- create_board_test_staff.sql (you+b-cb-9@example.org and so on) show the same name as you@example.org.
-- Add a row to the list below for each person. Do not commit real names or emails: the repo is public.
-- Keep the real list in a copy named set_staff_names.local.sql, which is git-ignored.

do $$
declare
  person  record;
  updated int;
begin
  for person in
    select * from (values
      ('you@example.org',       'Your Name'),
      ('colleague@example.org', 'Colleague Name')
    ) as people (email, full_name)
  loop
    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', person.full_name),
        updated_at = now()
    where regexp_replace(lower(email), '\+[^@]*@', '@') = lower(person.email);
    get diagnostics updated = row_count;
    if updated = 0 then
      raise notice 'No account for % (or a plus address of it).', person.email;
    end if;
  end loop;
end $$;

-- Check: every account and its name.
select email, raw_user_meta_data->>'full_name' as full_name
from auth.users
order by email;
