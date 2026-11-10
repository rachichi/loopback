-- Keep administrative tickets out of the public share view (WA-214). Data and two function bodies only.
--
-- A ticket type can carry "hidden_from_public": true in boards.ticket_types. The share-link functions then
-- leave out every ticket of that type, and public_board no longer lists the type, so neither the tickets
-- nor the type's name reach the public page. The filter is in the database, not the page: public_board_tickets
-- is what anon calls, and it is the only way the share page reads tickets.
--
-- Board Administration (membership, mentors, trainings, bylaws) is the type this is for. It is found once,
-- here, by its css_class 'admin'. After this the flag is the rule, so a board that adds another internal type
-- sets "hidden_from_public": true on it, and any migration that rewrites ticket_types must keep the flag.
--
-- public_board and public_board_tickets keep their result columns, so create or replace is enough and the
-- deployed client works before and after.

-- 1. Flag the administrative types on every board.
update public.boards b
set ticket_types = (
  select coalesce(
    jsonb_agg(case when e ->> 'css_class' = 'admin' then e || '{"hidden_from_public": true}'::jsonb else e end order by ord),
    '[]'::jsonb)
  from jsonb_array_elements(b.ticket_types) with ordinality as t(e, ord)
)
where jsonb_typeof(b.ticket_types) = 'array'
  and b.ticket_types @> '[{"css_class": "admin"}]'::jsonb;

-- 2. Tickets: none of a hidden type.
create or replace function public.public_board_tickets(token text)
returns table (id text, number integer, title text, type text, status text, urgent boolean, deadline date,
               location_text text, places jsonb, submitted_at date)
language sql stable security definer set search_path = public as $$
  select t.id, t.number, t.title, t.type, t.status, t.urgent, t.deadline, t.location_text, t.places, t.submitted_at
  from public.tickets t
  join public.boards b on b.id = t.board
  where length(token) >= 20 and b.share_token = token
    and not exists (
      select 1
      from jsonb_array_elements(case when jsonb_typeof(b.ticket_types) = 'array' then b.ticket_types else '[]'::jsonb end) e
      where e ->> 'label' = t.type and coalesce((e ->> 'hidden_from_public')::boolean, false)
    )
  order by t.number
$$;

-- 3. Board: the type list without the hidden types.
create or replace function public.public_board(token text)
returns table (id text, name text, borough text, logo_url text, background_url text, boundary_geojson jsonb,
               ticket_types jsonb, features jsonb)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.borough, b.logo_url, b.background_url, b.boundary_geojson,
         (select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
            from jsonb_array_elements(case when jsonb_typeof(b.ticket_types) = 'array' then b.ticket_types else '[]'::jsonb end)
                 with ordinality as t(e, ord)
           where not coalesce((e ->> 'hidden_from_public')::boolean, false)),
         (select coalesce(jsonb_object_agg(f.key, coalesce((b.features ->> f.key)::boolean, f.default_enabled)), '{}'::jsonb)
            from public.feature_flags f)
  from public.boards b
  where length(token) >= 20 and b.share_token = token
$$;
