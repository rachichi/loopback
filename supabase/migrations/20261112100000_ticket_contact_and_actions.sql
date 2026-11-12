-- Requester contact details and "Actions taken" on tickets. ADDITIVE: four columns with defaults.
--
-- contact_name, contact_phone and contact_email are who raised the issue, filled in on the intake form.
-- actions_taken is a second free-text field next to summary (shown as "Ticket details" in the app). The
-- summary column keeps its name so existing functions and approvals keep working.
-- public_board_tickets is unchanged, so share pages do not show any of these.

alter table public.tickets
  add column if not exists contact_name  text not null default '',
  add column if not exists contact_phone text not null default '',
  add column if not exists contact_email text not null default '',
  add column if not exists actions_taken text not null default '';
