-- Migration 2b: global feature defaults + per-board overrides. Additive, safe with the live app.
-- Run after migrations 1 and 2, before migration 3 (which adds this table's policies).
--
-- Effective flag for a board = board override if set, else the global default.
--   Turn a feature on for all boards:      update public.feature_flags set default_enabled = true where key = 'x';
--   Pilot on one board:                    update public.boards set features = features || '{"x": true}' where id = 'b-cb-9';
--   Make every board follow the default:   update public.boards set features = features - 'x';
-- Features with requires_board_setup = true (a Block Party source, an email inbox) should stay default-off
-- until each board is configured.

create table if not exists public.feature_flags (
  key                  text primary key,
  description          text not null default '',
  default_enabled      boolean not null default false,
  requires_board_setup boolean not null default false,
  created_at           timestamptz not null default now()
);

-- Locked until migration 3 adds policies (RLS on, no policy).
alter table public.feature_flags enable row level security;

insert into public.feature_flags (key, description, default_enabled, requires_board_setup) values
  ('manual_intake',       'Staff intake form',                                   true,  false),
  ('district_map',        'Ticket map over the board boundary',                  true,  false),
  ('transcript_matching', 'Transcript view and AI-drafted tickets (V2)',         false, true),
  ('email_intake',        'Tickets created from email (V3)',                     false, true),
  ('asset_generation',    'Social posts, resolutions, meeting minutes (V3)',     false, false),
  ('data_aggregation',    'Roll-up for borough presidents and mayors (V3)',      false, true)
on conflict (key) do nothing;

-- boards.features now holds overrides only. Clear the old full copies of the defaults.
alter table public.boards alter column features set default '{}'::jsonb;
update public.boards set features = '{}'::jsonb
where features = '{"manual_intake": true, "district_map": true}'::jsonb;

-- What the client reads: one row per board the caller can see, with every flag resolved.
create or replace view public.board_effective_features with (security_invoker = true) as
select
  b.id as board_id,
  (
    select coalesce(jsonb_object_agg(f.key, coalesce((b.features ->> f.key)::boolean, f.default_enabled)), '{}'::jsonb)
    from public.feature_flags f
  ) as features
from public.boards b;
