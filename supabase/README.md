# Supabase

Production project: `enanmsnprjviztiiemtn` ("Loopback"). How the pieces fit together is in [`docs/architecture.md`](../docs/architecture.md).

| Path | What it is |
| --- | --- |
| `migrations/` | Ordered schema changes. Add new files only; never edit one that has been applied. |
| `scripts/` | Admin SQL to run by hand in the SQL editor. Not migrations. |
| `seeds/boards/` | Output of `scripts/seed_boards.mjs`: the 59 NYC community boards with boundaries. |
| `seed.sql` | Sample CB3 tickets for a fresh database (`pnpm db:seed-sql` regenerates it). |
| `legacy/` | The original hand-pasted `schema.sql` and `002_board.sql`. Superseded by the baseline migration. |

## Migrations

Every file below is applied in production.

| File | Kind | What it does |
| --- | --- | --- |
| `20261020000000_baseline_tickets.sql` | Baseline | Original `tickets` table and demo policies. Pasted by hand before migrations existed. |
| `20261102120000_boards_additive.sql` | Additive | `boards`, `board_members`, `platform_admins`, new ticket columns, `ping()` |
| `20261102120100_boards_seed.sql` | Additive | `m-cb-3` and `b-cb-9` rows |
| `20261102120150_feature_flags.sql` | Additive | `feature_flags` defaults and `board_effective_features` |
| `20261102120200_tenant_policies_and_numbering.sql` | Additive | Policies for signed-in users, ticket-number trigger, metrics views |
| `20261102120300_drop_demo_policies.sql` | **Breaking** | Removes anonymous access |
| `20261102130000_board_assets.sql` | Additive | `boards.background_url`; logo and background URLs for `m-cb-3` and `b-cb-9` |
| `20261102140000_roles.sql` | Additive | `can_edit_board()`; staff and platform admins write, platform admins see every board |
| `20261102150000_user_lookup_for_invites.sql` | Additive | `user_id_by_email()` for volunteer invites. Dropped again by `160000`. |
| `20261102160000_public_share_links.sql` | Mixed | `boards.share_token`, `public_board()`, `public_board_tickets()`, `rotate_share_token()`; removes the volunteer role |
| `20261102170000_public_board_features.sql` | Additive | `public_board()` also returns the board's flags |
| `20261102180000_board_staff.sql` | Additive | `board_staff()` for the Owner column |
| `20261102190000_board_staff_names.sql` | Additive | `board_staff_named()`: staff with display names |
| `20261103100000_meetings_and_suggestions.sql` | Additive | `meetings`, `ticket_suggestions`, `apply_ticket_suggestion()`, `reject_ticket_suggestion()`, the `meeting_minutes` flag |

### Writing a migration

1. Name it `YYYYMMDDHHMMSS_what_it_does.sql`, later than every existing file.
2. Start the file with a comment saying what it does and whether it is additive or breaking.
3. Additive changes (new tables, columns, functions, wider checks) can go in before the app uses them. Breaking changes (dropping, narrowing, removing access) go in a later migration, after the client that no longer needs the old shape is deployed.
4. Every new table: `enable row level security`, then policies `to authenticated`. No `anon` grants on tables.
5. `security definer` functions: always `set search_path`, check permissions inside, and `revoke all ... from public` before granting to the roles that need it.
6. Apply it in the SQL editor (or with the CLI, see below), then check it with a query before merging code that depends on it.

### Migration history in production

The CLI's history table does not match the files, so **do not run `supabase db push` against production** until the history is repaired.

- The four `2026110212xxxx` additive migrations were applied with the Supabase MCP tool, which recorded them under its own versions (`20261102132812`, `20261102132842`, `20261102134215`, `20261102134248`).
- Everything else was pasted into the SQL editor and is not recorded at all.

To repair before first CLI use:

```bash
supabase link --project-ref enanmsnprjviztiiemtn
# Record every file as applied under its own version:
supabase migration repair --status applied \
  20261020000000 20261102120000 20261102120100 20261102120150 20261102120200 20261102120300 \
  20261102130000 20261102140000 20261102150000 20261102160000 20261102170000 20261102180000
# Remove the MCP-stamped versions:
supabase migration repair --status reverted 20261102132812 20261102132842 20261102134215 20261102134248
supabase migration list    # local and remote should now match with nothing pending
```

Re-running the baseline would re-create the demo policies and reopen anonymous access, so check `supabase migration list` before every `db push`. Add new migrations to the repair list above if they are applied by hand.

## Admin scripts (`scripts/`)

| Script | What it does |
| --- | --- |
| `add_platform_admin.sql` | Makes an existing account a platform admin. Set the email, run. |
| `create_board_test_staff.sql` | One plus-addressed staff account per board (`you+<board id>@domain`) for testing what each board's staff see. Writes to `auth.users` directly; never commit the password you set. |
| `check_tenant_isolation.sql` | Signs in as two boards' test staff and checks isolation, cross-board denial, ticket numbering, meeting and suggestion access, and feature flags. Always rolls back; results are in the error message. |
| `create_staging_board.sql` | Creates or refreshes the `staging` board: a copy of `b-cb-9`'s borough, boundary and ticket types with every feature flag on, for trying V2 and V3 features. No share link, no staff. |
| `seed_staging_tickets.sql` | About two hand-logged tickets per meeting in `evals/data/b-cb-9/` on the `staging` board, for transcript matching to enhance. Load the meetings first: `node scripts/load_meetings.mjs staging evals/data/b-cb-9/raw_*.txt`. |

Common one-liners (staff, flags, logos, ticket types) are in the root [`README.md`](../README.md#as-a-platform-admin-supabase-sql-editor).

## Functions the app calls

| Function | Who can call it | Returns |
| --- | --- | --- |
| `is_board_member(b)`, `is_platform_admin()`, `can_edit_board(b)` | Used inside policies | Booleans for the signed-in user |
| `board_staff(b)` | Signed-in | The board's staff and emails, if the caller is its staff or a platform admin |
| `rotate_share_token(b)` | Signed-in | A new share token, if the caller can edit the board |
| `apply_ticket_suggestion(s, edited)` | Signed-in, `security invoker` | Approves a pending suggestion (staff's edited fields, or as proposed) and returns the ticket |
| `reject_ticket_suggestion(s)` | Signed-in, `security invoker` | Rejects a pending suggestion |
| `public_board(token)` | Anyone | The board's name, borough, logo, background, boundary, ticket types and flags |
| `public_board_tickets(token)` | Anyone | Number, title, type, status, urgent, deadline, location, submitted date |
| `ping()` | Anyone | `true`; called daily by the keep-alive workflow |

## Seeding all 59 boards

1. Download the Community Districts GeoJSON from NYC Open Data (dataset `5crt-au7u`, Export) and check its terms of use.
2. `node scripts/seed_boards.mjs path/to/community-districts.geojson`
3. Run the files in `supabase/seeds/boards/` in the SQL editor. Boards that already exist keep their name, ticket types and flags; only the boundary is written. Boards with no members are inert.
