-- Sets the display name (auth user metadata full_name) shown on the home page and in the Owner column.
-- NOT a migration. Paste into the Supabase SQL editor and run. Safe to re-run.
--
-- Plus-addressed accounts get the name of their base address, so the per-board test staff accounts from
-- create_board_test_staff.sql (rl996+b-cb-9@cornell.edu and so on) show the same name as rl996@cornell.edu.
-- Add a row to the list below for each new person.

do $$
declare
  person  record;
  updated int;
begin
  for person in
    select * from (values
      ('rl996@cornell.edu',   'Rachel Liu'),
      ('ma2495@cornell.edu',  'Mujtaba Asghar'),
      ('darnwine@cb.nyc.gov', 'Dante B. Arnwine'),
      ('djo47@cornell.edu',   'David Opatrny'),
      ('bwr45@cornell.edu',   'Burke Reimann')
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
