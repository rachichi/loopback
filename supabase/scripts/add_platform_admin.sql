-- Makes an existing account a platform admin: every board, all tickets, feature flags and members.
-- NOT a migration. Paste into the Supabase SQL editor, set the email, and run. Safe to re-run.
-- The account must exist first (Authentication > Users > Add user).

do $$
declare
  admin_email constant text := 'you@example.org';
  uid uuid;
begin
  select id into uid from auth.users where email = lower(admin_email);
  if uid is null then
    raise exception 'No account with email %. Create it under Authentication > Users first.', admin_email;
  end if;
  insert into public.platform_admins (user_id) values (uid) on conflict (user_id) do nothing;
end $$;

-- Check
select u.email from public.platform_admins p join auth.users u on u.id = p.user_id order by u.email;
