-- Cross streets on tickets (WA-209). ADDITIVE: one nullable column.
--
-- cross_streets is { "a": text, "b": text }: the two streets a location sits between or at, typed by staff
-- in the ticket's location cell. It is plain text, not a map point: NYC GeoSearch does not find
-- intersections, so a cross-streets location has no pin unless staff also add a place.
-- public_board_tickets is unchanged, so share pages do not show it.

alter table public.tickets
  add column if not exists cross_streets jsonb;
