# Loopback

Loopback turns community board meetings into tracked follow-up work. Board staff log and update tickets, see them on a map of the district, and share a read-only view with the public.

One codebase and one database serve all 59 NYC community boards. A board's name, logo, boundary, ticket types and features live in the database, and Postgres row-level security keeps each board's tickets separate.

**Stack:** React 19, Vite, Tailwind CSS v4, Supabase (Postgres, Auth, RLS, Storage), Leaflet, Netlify.

## Docs

| Doc | What it covers |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | How the app works today: components, roles and permissions, data model, feature flags, analytics, environments |
| [`docs/refactor-spec.md`](docs/refactor-spec.md) | Source of truth for scope by version (V1, V2, V3), data model, security and rollout. Read before changing the data layer, auth or flags. |
| [`supabase/README.md`](supabase/README.md) | Migrations, what is applied in production, admin SQL scripts |
| [`docs/ideal-state.md`](docs/ideal-state.md) | Where the product is headed: transcripts, AI-drafted tickets, review and routing |
| [`AGENTS.md`](AGENTS.md) | Commands, layout and rules for contributors and coding agents |

## Quick start

Requires Node.js 22.12+ and pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
pnpm dev                     # http://localhost:5173
```

Sign in with an account that a platform admin has added to a board (see below). There is no sign-up page.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm typecheck` | TypeScript check |
| `pnpm build` | Production build to `dist/` |
| `pnpm check:bundle` | Fails if transcript code reaches the bundle (run after `build`) |
| `pnpm format` | Format with oxfmt |
| `pnpm evals:run`, `evals:score`, `evals:log` | Extraction evals in `evals/` (needs `ANTHROPIC_API_KEY`) |

CI runs `typecheck`, `build` and `check:bundle` on every pull request.

## Roles

| Role | Who | Can do |
| --- | --- | --- |
| **Platform admin** | The people running Loopback | Everything on every board, plus code, flags, boards and accounts |
| **Staff** | A board's district office staff | Create, edit, assign and delete their board's tickets; share the board's public link |
| **Public** | Anyone with a board's share link | Read a limited view of one board's tickets. No account. |

The database enforces these; see [Who can do what](docs/architecture.md#who-can-do-what).

## How to change things, by role

### As staff (in the app)

| To | Do |
| --- | --- |
| Add a ticket | **New ticket** in the toolbar, or **Submit a New Ticket** on Home. The number is assigned when it saves. |
| Edit a ticket | Edit any cell in the table. Changes save automatically about a second after you stop typing. |
| Assign an owner | Pick a staff member in the **Owner** column. |
| Add a place | In the **Map** column, click **+ Place** and search. Intersections must be placed by hand. |
| Delete a ticket | Hover the row and click the trash icon at the far right. This can't be undone. |
| Share a read-only view | **Share** in the nav, then **Copy**. Anyone with the link can view without signing in. |
| Cut off an old link | **Share**, then **Make a new link**. Every copy of the old link stops working. |

Staff can't turn features on or off, add colleagues, or change the board's name, logo or ticket types. Ask a platform admin.

### As a platform admin (Supabase SQL editor)

Day-to-day changes are SQL in the Supabase dashboard. Ready-made scripts are in [`supabase/scripts/`](supabase/scripts).

**Add a staff member**
1. Supabase → Authentication → Users → **Add user** (email and password, tick **Auto Confirm User**).
2. Run:
   ```sql
   insert into public.board_members (user_id, board_id, role)
   select id, 'm-cb-3', 'staff' from auth.users where email = 'person@example.com';
   ```

**Remove a staff member from a board**
```sql
delete from public.board_members
where board_id = 'm-cb-3' and user_id = (select id from auth.users where email = 'person@example.com');
```

**Make someone a platform admin:** edit the email in `supabase/scripts/add_platform_admin.sql` and run it.

**Turn a feature on or off for one board**
```sql
update public.boards set features = features || '{"district_map": false}' where id = 'm-cb-3';  -- off
update public.boards set features = features - 'district_map' where id = 'm-cb-3';             -- back to the default
```
Prefer removing the override over setting it to `true`, so the board follows the global default again.

**Change a feature for every board:** `update public.feature_flags set default_enabled = true where key = 'x';`

**See a board's resolved flags:** `select * from public.board_effective_features where board_id = 'm-cb-3';`

**Change a board's logo or home photo**
1. Upload to the public Storage bucket `board-assets` as `<board id>/logo.png` (or `.jpeg`) and `<board id>/background.jpg`.
2. Set the URL:
   ```sql
   update public.boards set
     logo_url = 'https://enanmsnprjviztiiemtn.supabase.co/storage/v1/object/public/board-assets/m-cb-3/logo.png'
   where id = 'm-cb-3';
   ```
   A board with no logo shows its name; with no photo, a neutral gradient.

**Edit a board's ticket types:** update `boards.ticket_types`, a JSON list of `{"label", "css_class", "definition"}`. `css_class` must be one of the classes in `src/index.css`: `quality`, `safety`, `liquor`, `land-use`, `transport`, `other`, `budget`, `admin`. Renaming a label does not rename existing tickets' types.

In the app, platform admins see a board switcher in the nav for moving between all 59 boards.

### As a developer (code)

1. **Branch from `main`** with a short-lived branch (`feat/...`, `fix/...`, `chore/...`). `main` is the only long-lived branch; never push to it directly.
2. **Read the spec** section for what you're changing. Check its version scope (V1, V2, V3).
3. **Database changes go in a new migration** in `supabase/migrations/` named `YYYYMMDDHHMMSS_what_it_does.sql`. Never edit one that has been applied. Make changes additive first; anything that breaks the deployed app goes in a later migration after the new client is live.
4. **Apply the migration before merging** code that depends on it (Supabase SQL editor), then confirm it in production.
5. **Run checks locally:** `pnpm typecheck && pnpm build && pnpm check:bundle`.
6. **Open a pull request.** CI and a Netlify deploy preview run on it. Check the preview, then merge. `main` deploys to production.

**Adding a feature flag**
1. Add the row in a new migration: `insert into public.feature_flags (key, description, default_enabled, requires_board_setup) values (...)`.
2. Add the key to `src/lib/features.ts`.
3. Gate the UI with `useFeature("your_key")`. If the feature costs money or touches secrets, check the flag server-side too.

## Practices

- **Nothing board-specific in code.** No board ids, names or `cb3`/`cb9` literals. Read from `useBoard()`.
- **Security lives in Postgres.** Every new table gets RLS and policies `to authenticated`. Never filter for security in the client, never give `anon` table access, and expose public data only through `security definer` functions that return chosen columns.
- **No secrets in the browser.** `VITE_*` variables are public. Secret keys belong in Supabase Edge Function secrets, Netlify secrets or GitHub secrets, never in `.env.local` with a `VITE_` prefix.
- **Tickets:** insert new ones with `number: 0` and update existing ones by id. Never mix them in one upsert.
- **Analytics never carries personal data.** Event parameters are ids and counts only. Add new events to the `EventName` list in `src/lib/analytics.ts`.
- **No em dashes** in code comments, docs or commit messages. Use double quotes for strings containing apostrophes. Export components as default exports.

## Deploys and configuration

| Variable | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `.env.local`, Netlify (all contexts) | Public by design |
| `VITE_GA_MEASUREMENT_ID` | Netlify **Production** only (optional in `.env.local`) | Leave unset elsewhere so previews don't send analytics |

Netlify builds every pull request as a deploy preview and `main` as production. If a deploy fails with missing modules, the build already relinks dependencies; report it rather than clearing the cache by hand.

## License

MIT, see `LICENSE`.
