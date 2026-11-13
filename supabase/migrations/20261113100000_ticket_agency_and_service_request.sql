-- Agency, 311 Service Request number and Date Opened on tickets. ADDITIVE: three columns.
--
-- agency is the name of the city agency the ticket was sent to, as text (from the list in
-- src/features/tickets/agencies.ts). sr_number is the 311 Service Request or work order number, typed by
-- staff. date_opened is when the request was opened with the agency, null until someone sets it.
-- public_board_tickets is unchanged, so share pages do not show any of these.

alter table public.tickets
  add column if not exists agency    text not null default '',
  add column if not exists sr_number text not null default '',
  add column if not exists date_opened date;
