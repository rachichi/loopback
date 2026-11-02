# Supabase

| Path | What it is |
| --- | --- |
| `migrations/` | Ordered SQL. Add new files only; never edit one that has been applied. |
| `seed.sql` | Sample tickets for local dev (`pnpm db:seed-sql` regenerates it from the bundled data). |
| `seeds/boards/` | Output of `scripts/seed_boards.mjs`: the 59 NYC community boards with boundaries. |
| `legacy/` | The original hand-pasted `schema.sql` and `002_board.sql`. Superseded by the baseline migration. |

## Migration order

| File | Kind |
| --- | --- |
| `20261020000000_baseline_tickets.sql` | Baseline: the original `tickets` table and demo policies. Already in production (pasted by hand on 2026-10-20). Do not re-run there. |
| `20261102120000_boards_additive.sql` | Additive: boards, board_members, platform_admins, new ticket columns, `ping()` |
| `20261102120100_boards_seed.sql` | Additive: `m-cb-3` and `b-cb-9` rows |
| `20261102120150_feature_flags.sql` | Additive: global flag defaults and `board_effective_features` |
| `20261102120200_tenant_policies_and_numbering.sql` | Additive: policies for signed-in users, server-side ticket numbers, metrics views |
| `20261102120300_drop_demo_policies.sql` | **Breaking**: removes anonymous access. Run only after the new client is deployed. |

## What is applied in production

Project `enanmsnprjviztiiemtn` ("Loopback"). The Supabase MCP tool applied the four additive migrations on 2026-11-02 and stamped its own versions:

| Applied version | File |
| --- | --- |
| `20261102132812` | `boards_additive` |
| `20261102132842` | `boards_seed` |
| `20261102134215` | `feature_flags` |
| `20261102134248` | `tenant_policies_and_numbering` |

The baseline was never recorded in the migration history, and the versions above differ from the filenames. Before using `supabase db push` against production, mark the history so the CLI does not re-run anything. The baseline re-creates the demo policies, so re-running it after 3b would reopen anonymous access:

```bash
supabase link --project-ref enanmsnprjviztiiemtn
supabase migration repair --status applied 20261020000000
# For each applied file, repair the filename version and revert the MCP-stamped version:
supabase migration repair --status applied 20261102120000 20261102120100 20261102120150 20261102120200
supabase migration repair --status reverted 20261102132812 20261102132842 20261102134215 20261102134248
supabase migration list    # local and remote columns should now match, with 20261102120300 pending
```

Check `supabase migration list` before every `db push`.

## Seeding all 59 boards

1. Download the Community Districts GeoJSON from NYC Open Data (dataset `5crt-au7u`, Export) and check its terms of use.
2. `node scripts/seed_boards.mjs path/to/community-districts.geojson`
3. Run the files in `supabase/seeds/boards/` in the SQL editor. Boards that already exist keep their name, ticket types and flags; only the boundary is written. Boards with no members are inert.
