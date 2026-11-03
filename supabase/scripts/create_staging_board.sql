-- A staging board with every feature flag on, for trying V2 and V3 features before any real board gets
-- them. NOT a migration. Paste into the Supabase SQL editor and run. Safe to re-run: it copies the source
-- board's boundary and ticket types again and turns on any flag added since the last run.
--
-- Copies the borough, boundary and ticket types of source_board. That is Brooklyn CB9, because the
-- meeting transcripts for transcript matching (evals/data/b-cb-9/, loaded with scripts/load_meetings.mjs)
-- are that board's. Every flag is set as an explicit override (true), so the board keeps them on even if
-- a global default is turned off. Re-runs keep the board's name, ticket counter and share token.
--
-- No share token is set, so the board has no public link until someone rotates one in the app. No staff
-- are added: platform admins see every board. For a staff view, run create_board_test_staff.sql, which
-- adds a plus-addressed account for every board, this one included.

do $$
declare
  board_id     constant text := 'staging';
  board_name   constant text := 'Staging Board';
  source_board constant text := 'b-cb-9';
  src          public.boards%rowtype;
begin
  select * into src from public.boards where id = source_board;
  if not found then
    raise exception 'No board %. Set source_board to an existing board id.', source_board;
  end if;

  insert into public.boards (id, name, borough, boundary_geojson, ticket_types, features)
  values (
    board_id, board_name, src.borough, src.boundary_geojson, src.ticket_types,
    (select coalesce(jsonb_object_agg(key, true), '{}'::jsonb) from public.feature_flags)
  )
  on conflict (id) do update set
    borough          = excluded.borough,
    boundary_geojson = excluded.boundary_geojson,
    ticket_types     = excluded.ticket_types,
    features         = excluded.features;
end $$;

-- Check: every flag true, the source board's types and boundary, no share token.
select b.id, b.name, b.borough, jsonb_array_length(b.ticket_types) as ticket_types,
       b.boundary_geojson is not null as has_boundary, b.share_token is null as no_public_link, f.features
from public.boards b join public.board_effective_features f on f.board_id = b.id
where b.id = 'staging';
