-- One staff account per board, to see the app as each board's staff do. NOT a migration.
-- Paste into the Supabase SQL editor, set the two values below, and run. Safe to re-run: existing
-- accounts keep their password, and their membership is set to staff (this also fixes accounts made
-- by the earlier version of this script, which made them admin). The password is only needed for new accounts.
--
-- Addresses are the base email plus-addressed with the board id: you@example.org -> you+b-cb-9@example.org.
-- Accounts are created confirmed, so no email is sent.
--
-- This writes to auth.users and auth.identities directly, shaped like the rows Supabase Auth creates
-- (checked against this project on 2026-11-02). Supabase's supported route is the Admin API; if sign-in
-- with these accounts ever fails after a Supabase upgrade, delete them and recreate them in the dashboard.
--
-- Do not commit a real password into this file. The SQL editor keeps query history, so use a test password.

do $$
declare
  base_email constant text := 'you@example.org';
  password   constant text := 'CHANGE_ME';
  board      record;
  address    text;
  uid        uuid;
  created    int := 0;
begin
  for board in select id from public.boards order by id loop
    address := lower(split_part(base_email, '@', 1) || '+' || board.id || '@' || split_part(base_email, '@', 2));

    select id into uid from auth.users where email = address;
    if uid is null then
      if password = 'CHANGE_ME' or length(password) < 8 then
        raise exception 'Set password to a test password of 8 or more characters first.';
      end if;
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', address,
        extensions.crypt(password, extensions.gen_salt('bf')), now(),
        '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
        '', '', '', ''
      );
      insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (
        uid, uid::text, 'email',
        jsonb_build_object('sub', uid::text, 'email', address, 'email_verified', true, 'phone_verified', false),
        now(), now(), now()
      );
      created := created + 1;
    end if;

    insert into public.board_members (user_id, board_id, role)
    values (uid, board.id, 'staff')
    on conflict (user_id, board_id) do update set role = 'staff';
  end loop;

  raise notice '% new accounts created. Sign in as %+<board id>@%.',
    created, split_part(base_email, '@', 1), split_part(base_email, '@', 2);
end $$;

-- Check: one staff row per board.
select m.board_id, u.email, m.role
from public.board_members m join auth.users u on u.id = m.user_id
where u.email like '%+%'
order by m.board_id;
