-- Lets the invite-volunteer Edge Function find an existing account by email, so inviting someone who
-- already has an account adds them to the board instead of failing. ADDITIVE.
-- Only the service role may call it: an email-to-account lookup must not be open to signed-in users.

create or replace function public.user_id_by_email(address text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where email = lower(trim(address)) limit 1
$$;

revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;
