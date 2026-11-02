-- The public share page honours the board's feature flags (for example, no map when district_map is off).
-- public_board gains a `features` column: the board's resolved flags, computed the same way as
-- board_effective_features. Flags hold no personal data.
--
-- A function's result columns can't change with create or replace, so it is dropped and recreated in one
-- transaction. Compatible with the deployed client, which ignores columns it doesn't read.

begin;

drop function if exists public.public_board(text);

create function public.public_board(token text)
returns table (id text, name text, borough text, logo_url text, background_url text, boundary_geojson jsonb,
               ticket_types jsonb, features jsonb)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.borough, b.logo_url, b.background_url, b.boundary_geojson, b.ticket_types,
         (select coalesce(jsonb_object_agg(f.key, coalesce((b.features ->> f.key)::boolean, f.default_enabled)), '{}'::jsonb)
            from public.feature_flags f)
  from public.boards b
  where length(token) >= 20 and b.share_token = token
$$;

revoke all on function public.public_board(text) from public;
grant execute on function public.public_board(text) to anon, authenticated;

commit;
