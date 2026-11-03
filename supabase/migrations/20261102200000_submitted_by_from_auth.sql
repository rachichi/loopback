-- submitted_by for a manual ticket is the signed-in user's email, set here rather than typed into the
-- intake form (spec section 6.2). ADDITIVE. Run this BEFORE deploying the client that stops sending a
-- name, or new tickets are saved with an empty submitted_by.
-- Inserts without a signed-in user (SQL editor seeds) and non-manual sources (transcript, email) keep
-- the submitted_by they send.

create or replace function public.set_submitted_by() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and new.source = 'manual' then
    new.submitted_by := coalesce(nullif(auth.jwt() ->> 'email', ''), new.submitted_by);
  end if;
  return new;
end $$;

drop trigger if exists tickets_submitted_by on public.tickets;
create trigger tickets_submitted_by before insert on public.tickets
  for each row execute function public.set_submitted_by();
