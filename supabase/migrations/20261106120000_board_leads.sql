-- Requests from the landing page's "Get Loopback for your board" form. Additive.
--
-- Visitors are not signed in and the table stays closed to anon: the submit-lead Edge Function validates the
-- request and inserts with the service role, then emails the team. Platform admins can read the leads.
create table if not exists public.board_leads (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (length(email) between 3 and 254),
  details    text not null check (length(details) between 1 and 4000),
  created_at timestamptz not null default now(),
  -- When the notification email was sent; null if it has not been, or failed.
  emailed_at timestamptz
);

alter table public.board_leads enable row level security;

create policy board_leads_platform_admin_read on public.board_leads
  for select to authenticated using (public.is_platform_admin());
