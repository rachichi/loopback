# Loopback refactor spec: one trunk, config-driven boards, V1 scope

Audience: Claude Code, working in `rachichi/loopback`.
Goal: replace the per-board, per-environment branch sprawl with one codebase on `main`. A board's identity, ticket types, boundary, branding and enabled features live in the database. V1 ships on top of that.

## 0. Ground rules

- Move and rename before rewriting. Keep existing components (`TicketTable`, `IntakeForm`, `MapView`, `TranscriptView`, `DictateButton`) and change their inputs, not their internals.
- One PR per numbered step in section 9. Each PR must pass `pnpm typecheck` and `pnpm build`.
- No new dependencies unless a step names one.
- No em dashes in code comments, docs, or commit messages.
- Do not push to `main` directly. Open PRs.

## 1. Current state (verified against the remote on 2026-11-02)

| Branch | Last commit | What it is | Problem |
| --- | --- | --- | --- |
| `main` | 2026-10-27 | Original CB3 portal prototype on sample data (Home, Calendar, Templates, Outreach, Forum, Dashboard), 1204-line `App.tsx` | 9,572 files of `node_modules` and 8 `dist` files tracked. `package.json` name is `figma-make-app`. `AGENTS.md` is Figma Make boilerplate. No `.gitignore`. |
| `staging` | 2026-10-12 | Eval harness + Leaflet map + transcript view, CB3 only | Diverged from `main`. 1,367 tracked `node_modules`/`dist` files. |
| `ideal-state` | 2026-10-12 | `staging` + a README describing the target architecture | Same tracked junk. README references an `mvp-state` branch that does not exist on the remote. |
| `bcb9` | 2026-10-20 | Most complete app: Supabase persistence, intake form, dictation, `VITE_BOARD`, CB9 branding | CB3 assumptions still hardcoded. Open RLS. Selected as the base for the new trunk. |

Findings that drive the work:

1. **Board scoping is client-side only.** `src/db.ts` reads `VITE_BOARD` and filters with `.eq("board", board)`. RLS policies in `supabase/schema.sql` are `using (true)` for `anon`. Any visitor with the public anon key can read and write every board's tickets. This must be fixed before any real data goes in.
2. **Board identity is hardcoded in five places** in `bcb9`:
   - `src/App.tsx`: `Logo()` (CB9 logo and aria labels), Home `<h1>hey cb9</h1>`.
   - `src/MapView.tsx`: statically imports `cb3-boundary.geojson`, frames the map on it.
   - `src/geosearch.ts`: sorts Manhattan results first.
   - `src/goldTickets.ts`: `ticketTypes`, `typeClass` colors, CB3 seed places, CB3 CSV imports.
   - `src/meetings.ts`: bundles two CB3 transcripts into the client, even on the CB9 deployment.
3. **Ticket numbers are assigned client-side** (`initialTickets` index, `Number(ticket.number)` in `toRow`). Two staff creating tickets at once will collide. There is only a non-unique index on `(board, number)`.
4. **Schema is applied by pasting SQL** (`schema.sql`, `002_board.sql`). No migration history. `002_board.sql` backfills every existing ticket as `m-cb-3`.
5. **Eval harness is mixed into the app root**: `lib/`, `scripts/`, `prompts/`, `runs/`, `results.csv`, `data/`. `data/` holds gold tickets and transcripts. The repo was public until 2026-11-02, private until 2026-11-04, and is now public under the MIT license.
6. **No CI, no typecheck script, no tests.**
7. **Sample-data fallback in `db.ts`** means a missing env var silently runs the app on fake data and saves nothing.

## 2. Version map

Read from the hand-drawn journey. Dot colors: purple = V1, blue = V2, green = V3. Each version includes the previous ones.

| Node | Version | Flag key | Notes |
| --- | --- | --- | --- |
| Government authentication | V1 | none (always on) | See section 5. Invite-only staff accounts tied to a board. Self sign-up and .gov SSO are V3. |
| Board identification, ticket table filtered to the board | V1 | none | Required for the refactor goal. Resolved from `board_members`. |
| Manual intake form | V1 | `manual_intake` | Exists (`IntakeForm.tsx`). |
| Ticket table | V1 | none | Exists. Critical columns and metrics defined in section 6. |
| District map | V1 | `district_map` | Exists (`MapView.tsx`). Boundary becomes per board. |
| Admin panel + features on/off | V2 | none | V1 ships the `boards.features` column and `useFeature()`. The admin UI is V2. |
| Transcript matching (Block Party) | V2 | `transcript_matching` | In progress on the `staging` board (2026-11-03). Staff log tickets during the meeting; the transcript arrives about 24 hours later and `match-transcript` suggests updates to those tickets (evidence paragraphs, changed fields) and new tickets for issues staff missed. Transcripts are loaded by hand into `meetings` until the Block Party connection exists. See `docs/architecture.md`. |
| Human approve / edit of every AI output | V2 | with `transcript_matching` | Confirmed V2 (2026-11-03): every suggestion is approved, edited then approved, or rejected by staff in the Transcript tab. Decisions are kept in `ticket_suggestions`. |
| Meeting minutes | V3 | `meeting_minutes` | Requested 2026-11-03. Boards must post minutes within two weeks of a meeting. A "Generate meeting minutes" button on a processed transcript, prompted with the board's past minutes. First version: the `meetings_tab` flag (staging only), one Generate button for tickets and minutes. |
| Email intake | V3 | `email_intake` | |
| Asset generation: social posts, resolutions, meeting minutes (docx/pdf) | V3 | `asset_generation` | |
| Aggregate to borough presidents and mayors | V3 | `data_aggregation` | Cross-board. Conflicts with tenant isolation, see section 8. |
| Land on the ticket board after switching boards (WA-196) | V2 | none | Picking a board in the switcher opens its Tickets view instead of Home. To test with staff before V1 sign-off. |
| Self sign-up: @cb.nyc.gov email or NYC employee SSO | V3 | none (project auth setting, not a board flag) | Decided 2026-11-05. Every kind of self sign-up is V3; V1 and V2 stay invite-only. See section 8 and WA-195. |

## 3. Target architecture

- One repo, one trunk (`main`), short-lived feature branches, PRs required.
- One multi-tenant app deployment. The board is resolved from the signed-in user's `board_members` row. No `VITE_BOARD`. No per-board build.
- Everything board-specific is a row in `boards`: name, borough, logo, boundary, ticket types, enabled features.
- Tenant isolation is enforced by Postgres RLS. The client filter is only a convenience.
- Environments: `main` deploys to production Netlify + production Supabase project. Deploy previews and branch deploys use a separate staging Supabase project. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` per Netlify deploy context in the Netlify UI. No long-lived `staging` branch.
- Secrets (Anthropic key, Block Party key) never reach the browser. V2 puts model calls in a Supabase Edge Function.

Target layout, reached by moving files, not rewriting:

```
src/
  main.tsx, App.tsx
  lib/            supabase client, BoardProvider, useBoard, useFeature, features.ts
  features/
    tickets/      TicketTable, TicketRow, columns, metrics
    intake/       IntakeForm, DictateButton
    map/          MapView, LocationCell, geosearch
    transcript/   TranscriptView, transcript.ts, meetings source   (V2, flagged off)
evals/            lib/, scripts/, prompts/, runs/, data/, results.csv   (own package.json scripts, not bundled)
supabase/
  migrations/     timestamped SQL, applied with the Supabase CLI
  seed.sql        dev/staging seed only
docs/
  architecture.md (from the ideal-state README), versions.md (section 2 of this file)
```

## 4. Data model changes

Keep `boards.id` as the existing text slug (`m-cb-3`, `b-cb-9`) so the current `tickets.board` values stay valid.

```sql
create table public.boards (
  id               text primary key,
  name             text not null,
  borough          text not null,
  logo_url         text,
  boundary_geojson jsonb,
  ticket_types     jsonb not null default '[]',  -- [{ label, css_class, definition }]; colors stay in src/index.css by class
  features         jsonb not null default '{}',  -- per-board overrides only; defaults live in feature_flags
  next_ticket_no   integer not null default 1,
  created_at       timestamptz not null default now()
);

create table public.board_members (
  user_id  uuid not null references auth.users on delete cascade,
  board_id text not null references public.boards on delete cascade,
  role     text not null check (role in ('admin', 'staff')),
  primary key (user_id, board_id)
);

create table public.platform_admins (
  user_id uuid primary key references auth.users on delete cascade
);

alter table public.tickets
  add column source     text not null default 'manual' check (source in ('manual', 'transcript', 'email')),
  add column closed_at  timestamptz,
  add column created_by uuid references auth.users,
  add column owner_id   uuid references auth.users,
  add constraint tickets_board_fk foreign key (board) references public.boards (id),
  add constraint tickets_board_number_uq unique (board, number);
```

Required triggers:

- Before insert on `tickets`: when `number` is null or `<= 0`, assign it from `boards.next_ticket_no` and increment atomically (the update takes a row lock on the board). The client sends `number: 0` for a new ticket. Existing tickets keep their number.
- Before insert or update on `tickets`: set `closed_at = now()` when `status` becomes `Closed`, null it when reopened.

Feature flags use global defaults plus per-board overrides. `feature_flags (key, description, default_enabled, requires_board_setup)` holds the defaults. `boards.features` holds only overrides. The view `board_effective_features` (security invoker) resolves each board's flags: override if present, else default. The client reads that view and nothing else.

| Goal | Operation |
| --- | --- |
| Turn a feature on for all current and future boards | `update feature_flags set default_enabled = true where key = 'x'` |
| Pilot a feature on one board | `update boards set features = features \|\| '{"x": true}' where id = '...'` |
| Make every board follow the default again | `update boards set features = features - 'x'` |

Features with `requires_board_setup = true` (Block Party source, email inbox) stay default-off until each board is configured.

Keep-alive: `public.ping()` returns `true`, is `security definer`, and is callable by `anon`. A daily GitHub Action calls it (section 12).

The SQL for all of this is written and mostly applied. Use these files as migrations rather than rewriting them:

| File | Production status (project `enanmsnprjviztiiemtn`, 2026-11-02) | Safe with the live app |
| --- | --- | --- |
| `20261102120000_boards_additive.sql` | Applied | Yes |
| `20261102120100_boards_seed.sql` | Applied | Yes |
| `20261102120150_feature_flags.sql` | Applied | Yes |
| `20261102120200_tenant_policies_and_numbering.sql` | Applied | Yes, additive. The demo policies stay. |
| `20261102120300_drop_demo_policies.sql` | Applied in the SQL editor, so not in the migration history | No, removes anonymous access |

These were applied with the Supabase MCP tool, which stamps its own version numbers, so the CLI's migration list will not match the filenames. See `supabase/README.md`.

3a was tested inside a transaction that always rolled back (nothing persisted): a `b-cb-9` user saw 5 of the 29 tickets and none from `m-cb-3`; a cross-board insert was denied; a cross-board update changed 0 rows; moving a ticket to another board was denied; a new ticket sent with `number: 0` got number 6; `closed_at` was set on close; a staff user could not delete; effective flags resolved to the defaults. Production was checked afterwards: still 29 tickets, `next_ticket_no` still 6 and 25.

Production held 29 tickets (24 `m-cb-3`, 5 `b-cb-9`). 3b is applied, so the anon key no longer reads or writes any ticket.

Data moves already done by migration 2: `m-cb-3` and `b-cb-9` exist in `boards`, `m-cb-3` has its boundary (from `src/data/cb3-boundary.geojson`), and both have the 8 ticket types with definitions. Remaining: boundaries for `b-cb-9` and the other 57 boards via `scripts/seed_boards.mjs` (section 9, step 4). Statuses stay global (`Open`, `In Progress`, `Closed`).

Do not edit applied migrations. Add new files.

## 5. Auth and RLS (V1)

Auth: Supabase Auth, email + password or magic link, **invite-only** (disable open signup). A platform admin creates the user and inserts a `board_members` row. "Government authentication" in V1 means board staff accounts. Self sign-up of any kind (domain-restricted email or city SSO) is V3, see section 8.

RLS. Migration 3a adds these policies next to the existing `demo` ones; migration 3b drops the three `demo` policies. 3a also defines `is_board_admin(b)`.

```sql
create function public.is_board_member(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from board_members where user_id = auth.uid() and board_id = b)
$$;

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;
```

| Table | select | insert | update | delete |
| --- | --- | --- | --- | --- |
| `tickets` | `is_board_member(board)` or platform admin | `can_edit_board(board)` | `can_edit_board(board)` using + with check | `can_edit_board(board)` |
| `boards` | member of that board, or platform admin | platform admin | platform admin (this is how flags are set) | none |
| `board_members` | own rows, or platform admin | platform admin | platform admin | platform admin |
| `feature_flags` | any signed-in user | platform admin | platform admin | platform admin |

All policies `to authenticated`. No `anon` access to any table in V1. Enable RLS on the three new tables.

Roles (decided 2026-11-02, migrations `20261102140000_roles.sql` and `20261102160000_public_share_links.sql`):

| Role | Stored in | Access |
| --- | --- | --- |
| Platform admin | `platform_admins` | Every board: read, create, edit and delete tickets; boards, flags and members |
| Staff | `board_members.role = 'staff'` (legacy `'admin'` counts as staff) | Own board: read, create, edit and delete tickets |
| Public | a board's share link, `/share/<token>` | Own board's tickets, read only, limited fields |

`can_edit_board(b)` is true for platform admins and for staff of `b`. There is no volunteer role; read-only access is the share link.

Public share links. Each board has a random `boards.share_token` (24 characters). `anon` still has no access to any table: the share page calls two `security definer` functions, `public_board(token)` and `public_board_tickets(token)`, which return only number, title, type, status, urgent, deadline, location text and places, and submitted date. Requester, summary, `submitted_by`, meeting ids, spans, `created_by` and `owner_id` are never returned. Staff and platform admins replace a board's link with `rotate_share_token(b)`, which stops every copy of the old link.

Acceptance test: a user in `b-cb-9` cannot select, insert, update or delete a ticket with `board = 'm-cb-3'`, including by changing `board` in an update. This is `supabase/scripts/check_tenant_isolation.sql`, which also checks ticket numbering and feature flag resolution and rolls everything back. It passed in production on 2026-11-02, after 3b: each test user saw only their own board (5 and 24 tickets), a new `b-cb-9` ticket got number 8 (the next `next_ticket_no`; numbers are not reused after a delete), all four cross-board writes were denied or changed 0 rows, a `b-cb-9` override turned `district_map` off for that board only, and the default turned it off and on for all 59 boards. The anonymous `curl` against `/rest/v1/tickets` returned `[]`.

It passed again on 2026-11-03 with the transcript matching checks added (migration `20261103100000_meetings_and_suggestions.sql`). Staff of `b-cb-9` saw 0 of a test staging meeting and suggestion. Their approve and reject were denied (P0002), and a direct update of the suggestion changed 0 rows. Staging staff then approved it, which made ticket 22 with source `transcript` and one meeting. Isolation and flags gave the same results as before (5 and 24 tickets, 60 boards). Afterwards the staging and `b-cb-9` ticket counters, the suggestions table and the flags were unchanged. `match-transcript` answers 401 to the anon key.

## 6. V1 product scope

### 6.1 Flow

1. Staff signs in.
2. App loads their `board_members` row, then the `boards` row. `BoardProvider` exposes `board` (name, logo, boundary, ticket types, features) and `useFeature(key)`.
3. Ticket table shows only that board's tickets.
4. Staff add tickets through the intake form (`source = 'manual'`) or edit inline in the table.
5. Map shows ticket locations over the board's boundary.

### 6.2 Critical columns (answers the open question on the sketch)

~~Table columns, in order: `#`, Title, Type, Status, Urgent, Deadline, Location, Summary, Source. The checkbox column has no row position number; `#` is the ticket's number.~~
~~Stored but not shown in the table: `requester`, `owner_id`, `submitted_by`, `submitted_at`, `created_by`, `closed_at`, `meeting_ids`, evidence spans.~~

**Changed 2026-11-03:** the table works like Airtable. Columns, in order: Title, Type, Status, Urgent, Deadline, Location, Summary.
Stored but not shown in the table: `number`, `source`, `requester`, `owner_id`, `submitted_by`, `submitted_at`, `created_by`, `closed_at`, `meeting_ids`, evidence spans. `source` still records where a ticket came from: `manual` for the form, `transcript` for AI proposals.
The left column shows the row's position in the current view. On hover it becomes a checkbox and an Expand button. Right-click deletes the row, or every checked row. Expand opens the ticket in the form layout and edits it in place.
Row height (Short, Medium, Tall, Extra tall) and column widths are per-viewer settings kept in browser storage.
The intake form does not ask for requester, submitted by or the date. `submitted_at` is the local date the ticket is logged, and for a manual ticket the `tickets_submitted_by` trigger sets `submitted_by` to the signed-in user's email.

### 6.3 Metrics (answers the open question on the sketch)

Provide one view `board_ticket_metrics`, created `with (security_invoker = true)` so RLS applies (views bypass RLS by default). Per board:

| Metric | Definition |
| --- | --- |
| Open count | `status <> 'Closed'` |
| By status, by type | counts |
| Overdue | `deadline < current_date and status <> 'Closed'` |
| Median days to close | median of `closed_at - submitted_at` over closed tickets |
| Open age | median and max of `now() - submitted_at` over open tickets |
| By source | counts per `source` (becomes the manual vs AI split in V2) |

~~Show these as a compact strip above the ticket table. No charts library in V1.~~

**Changed 2026-11-02:** the strip was built (PR #10) and removed. "Metrics" meant usage analytics, not ticket statistics. The `board_ticket_metrics` and `board_ticket_counts` views stay in the database, unused by the app, for a later report.

~~Usage analytics: Google Analytics 4, loaded by `src/lib/analytics.ts` only when `VITE_GA_MEASUREMENT_ID` is set.~~

**Changed 2026-11-02:** Google Analytics was replaced by Better Stack. Usage analytics: Better Stack's JS tag, loaded by `src/lib/analytics.ts` only when `VITE_BETTERSTACK_TOKEN` is set. It sends screen views (`/`, `/tickets`, `/sign-in`, `/share/:token`), the events `login`, `ticket_created`, `ticket_deleted`, `share_link_copied`, `share_link_replaced` and `board_switched`, `board_id` and `role` on each, web vitals and frontend errors. It never sends ticket content, names, emails, user ids, query strings, hashes or share tokens. Session replays, console logs and click autocapture stay off in Better Stack.

### 6.4 Explicitly out of V1

Admin UI, feature toggle UI, transcript view in the nav, Block Party, Claude calls, email intake, asset generation, aggregation, resident-facing intake, notifications, per-ticket audit log (`ticket_events` lands in V2 with approve/reject).

## 7. Frontend changes

| File | Change |
| --- | --- |
| `src/db.ts` | Delete the module-level `board` constant and the null-client sample fallback. Export the Supabase client only. Queries take the board from context. Missing env vars throw a clear startup error. Replace the single `saveTickets` upsert with two paths: `insert` for new tickets (send `number: 0`, the trigger assigns it) and `update` by id for existing ones. A mixed upsert would still consume a counter value on rows that already exist. After an insert, read the returned row to get the real number. |
| `src/lib/board.tsx` (new) | `BoardProvider`, `useBoard()`, `useFeature(key)`. Reads resolved flags from `board_effective_features`. Unknown key returns `false`. |
| `src/lib/features.ts` (new) | `FeatureKey` union from section 2, with default state per version. Single source of truth for keys. |
| `src/App.tsx` | `Logo()`, Home heading, and footer read from `useBoard()`. Add a sign-in screen and a gate that renders nothing board-specific until the board resolves. Nav items render through `useFeature`. Split into `features/*` as it shrinks. |
| `src/MapView.tsx` | Take `boundary` from the board. If null, frame on NYC bounds. Remove the static geojson import. |
| `src/geosearch.ts` | Replace "Manhattan first" with a bias toward `board.borough`. |
| `src/goldTickets.ts` | Remove `ticketTypes`, `typeClass` colors, seed places and CSV imports. Types and colors come from `board.ticket_types`. Gold data moves to `evals/`. Keep shared types (`Ticket`, `Status`, `Place`, `EvidenceSpan`) in `src/features/tickets/types.ts`. |
| `src/meetings.ts` | Not imported in V1, so the raw transcripts leave the client bundle. V2 re-introduces it behind `transcript_matching` behind a `TranscriptSource` interface (bundled demo source, Block Party source). |
| Logos and boundaries | Move per-board images to a public Supabase Storage bucket, referenced by `boards.logo_url`. Remove `bklyncb9_*` and `mancb3_logo.png` from `public/`. Keep `loopback_logo.png`. |

Known limitation to leave as a TODO, not fix in V1: `saveTickets` upserts whole rows, so concurrent edits by two staff are last-write-wins. Add an `updated_at` check before more than one person edits the same board at the same time.

## 8. V2 and V3 constraints to design for now

- Admin panel (V2): writes `boards.features`, platform admins only. Board admins see their flags read-only. Confirm.
- Transcript matching (V2): extraction runs in a Supabase Edge Function that checks `features.transcript_matching` server-side, since a client flag is not enforcement. Anthropic key lives in function secrets. Reuse `lib/extract.ts` and `prompts/` from `evals/`. Whether Block Party exposes the API the sketch assumes is unverified, so keep the `TranscriptSource` seam.
- Aggregation (V3): RLS isolation means no cross-board reads. Use a `security definer` function or materialized view that returns counts only, with no ticket rows, no names, and a minimum cell size before a board's numbers are shown to a borough president or mayor. Needs board consent. Decide before building.
- Self sign-up (V3, WA-195): a verified email or SSO login does not say which board someone is on, so `board_members` stays the gate. New users wait for approval and see no board data. Domain sign-up needs custom SMTP, 6-digit email codes instead of magic links (city mail scanners open links first and use up one-time tokens), a Supabase "Before User Created" hook that only allows `@cb.nyc.gov`, and periodic membership review for people who leave. City SSO needs a city sponsor (district managers, the Mayor's Community Affairs Unit), OTI to register the app, a NYC Cyber Command security review and a privacy review. SAML needs Supabase Pro or above; Supabase's Microsoft ("Azure") OIDC provider does not.

## 9. Execution order (one PR each)

0. **Archive tags.** The authoring session's git policy refused the tag push (HTTP 403), so run this locally. The old branches still exist; nothing was deleted.

```bash
git fetch origin
for b in main staging ideal-state bcb9; do
  git tag "archive/$b-$(git log -1 --format=%cd --date=short origin/$b)" "origin/$b"
done
git push origin 'refs/tags/archive/*'
```

1. **New trunk.** PR `chore/trunk-from-bcb9` into `main`. One commit whose tree equals `bcb9` and whose parent is the old `main` tip, so history is preserved. `bcb9` is the renamed `mvp-state`.
2. **CI and keep-alive.** PR `chore/ci-and-keepalive` (stacked on step 1): `.github/workflows/ci.yml` (`pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`), `keep-alive.yml`, and a `typecheck` script. Branch protection on private repos needs a paid GitHub plan, so enforce "CI green before merge" by convention. This PR's CI run is the first time typecheck and build run, because the package registry was unreachable from the authoring session. If typecheck fails on existing code, fix it here before stacking more on top.
3. **Repo hygiene.** PR `chore/repo-hygiene` (stacked on step 2): untrack `dist/` and `.DS_Store`, extend `.gitignore`, move `lib/`, `prompts/`, `runs/`, `data/`, `results.csv` and the eval scripts into `evals/`, fix the five `?raw` imports in `src/`, new `AGENTS.md`/`CLAUDE.md`/`README.md`, `docs/`. `.figma/make/site.json` stays tracked because `vite.config.ts` reads it for the page title. `scripts/make_supabase_seed.mjs` stays in `scripts/` because it imports from `src/`.
4. **Supabase files.** PR `chore/supabase-files` (stacked on step 3): `supabase/migrations/*`, `supabase/README.md`, `scripts/seed_boards.mjs`, legacy SQL moved to `supabase/legacy/`. After the user supplies the NYC GeoJSON: run `node scripts/seed_boards.mjs <file>` (keeps the 59 districts, drops joint interest areas, rounds and simplifies coordinates, exits non-zero unless it finds exactly 59, one SQL file per borough), then apply the five files. Existing boards keep their name, types and flags. Check the `m-cb-3` boundary against the one already stored.
5. **Auth and client (local Claude Code).** Section 5, `BoardProvider`, sign-in screen, `db.ts` insert/update split, removal of `VITE_BOARD` and the sample fallback. Release order, no downtime: 3a is already applied, deploy the client, create staff users and `board_members` rows, confirm sign-in works, then apply 3b. Include the cross-board denial test.
6. **Remove hardcoding.** The remaining rows of section 7 (`App.tsx` branding, `MapView`, `geosearch`, `goldTickets`, `meetings`, logos).
7. **Feature flags.** `features.ts`, `useFeature`, nav and component gating. Verify with `transcript_matching` false that no transcript code is reachable from the UI.
8. **Columns and metrics.** Section 6.2 and 6.3. Done; the metrics strip was then replaced by usage analytics (section 6.3).
9. **Environments.** Netlify deploy contexts mapped to production and staging Supabase projects. Delete the old remote branches only after step 5 is deployed and verified.

## 10. Open decisions (do not guess, ask)

Resolved on 2026-11-02:
- Repo is private.
- V1 authentication is invite-only email accounts, with open signup disabled.

Resolved on 2026-11-05:
- Every kind of self sign-up (@cb.nyc.gov email or NYC employee SSO) is V3.

Still open:
1. Who toggles features: platform admins only (assumed) or board admins too.
2. ~~Approve/reject placement in V2 (assumed) versus V3.~~ Resolved 2026-11-03: V2, with transcript matching.
3. Supabase staging project: a second free project (assumed). Free projects are paused after about a week of low activity (Supabase docs give no exact threshold). The keep-alive Action is a workaround, not a guarantee. Upgrade production to a paid plan before real board staff depend on it.
4. The user downloads the Community Districts GeoJSON from NYC Open Data (dataset `5crt-au7u`) and confirms the terms of use on the dataset's About page. The license text could not be read when this spec was written. Do not invent boundaries.

## 11. Definition of done for V1

- `main` is the only long-lived branch. `pnpm install && pnpm typecheck && pnpm build` pass in CI from a clean checkout.
- No `node_modules`, `dist`, `.DS_Store`, or `.env*` tracked.
- Two boards (`m-cb-3`, `b-cb-9`) served by the same deployment. A staff user from each sees only their own board's tickets, logo, boundary and ticket types.
- Cross-board read and write attempts fail at the database.
- Creating tickets concurrently never produces duplicate numbers within a board.
- Turning `manual_intake` or `district_map` off in `boards.features` hides the feature with no code change.
- Usage analytics report page views and events in Better Stack, with no share tokens or personal data.
- The keep-alive workflow has run green at least once from the Actions tab.

## 12. Supabase and GitHub setup runbook (user does these in the dashboards)

Do staging first. Repeat on production only after staging is verified.

1. **Project.** Create a second Supabase project for staging (free). Keep the existing project as production.
2. **Migrations 1 and 2.** SQL Editor, New query, paste `20261102120000_boards_additive.sql`, Run. Then `20261102120100_boards_seed.sql`, `20261102120150_feature_flags.sql` and `20261102120200_tenant_policies_and_numbering.sql`, each in order. Check: `select id, next_ticket_no from public.boards;` returns `m-cb-3` and `b-cb-9`, and `select public.ping();` returns `true`.
3. **Do not run `20261102120300_drop_demo_policies.sql` yet.** It removes anonymous access. Run it only after the new client is deployed and a staff user can sign in. For production, migrations 1 to 3a are already applied.
4. **Auth.** Authentication, Users, add or invite each staff member by email. In the authentication settings, turn off new user signups (the toggle is named along the lines of "Allow new users to sign up"; the exact menu path varies by dashboard version).
5. **Memberships.** In the SQL Editor, which runs as the postgres role and bypasses RLS:

```sql
insert into public.board_members (user_id, board_id, role)
select id, 'b-cb-9', 'staff' from auth.users where email = 'staff@example.org';

insert into public.platform_admins (user_id)
select id from auth.users where email = 'you@example.org';
```

6. **Change a feature.** For one board (override):

```sql
update public.boards set features = features || '{"transcript_matching": true}' where id = 'b-cb-9';
```

For every board (default):

```sql
update public.feature_flags set default_enabled = true where key = 'manual_intake';
```

7. **Keep-alive.** GitHub, repo Settings, Secrets and variables, Actions: add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (production) and optionally `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_ANON_KEY`. The anon key is public by design but is still stored as a secret. Run the workflow once from the Actions tab (Run workflow) and confirm green. Scheduled workflows are disabled after 60 days without repo activity only in public repos, so this does not apply now that the repo is private.
