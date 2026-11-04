# Loopback

Ticket tracker for NYC community boards. Staff review tickets from board meetings against the transcript and a map of the district. React 19, Vite, Tailwind CSS v4, Supabase (Postgres, Auth, RLS).

`docs/refactor-spec.md` is the source of truth for scope, data model, security and rollout. Read it before changing the data layer, auth, or feature flags. Version scope (V1 purple, V2 blue, V3 green) is in its section 2.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm typecheck` | `tsc --noEmit` over `src/` and `vite.config.ts` |
| `pnpm build` | Production build to `dist/` |
| `pnpm check:bundle` | After `build`: fails if transcript UI code is in the entry chunk, or CB3 demo data is in any chunk |
| `pnpm format` | oxfmt |
| `pnpm evals:run`, `evals:score`, `evals:log` | Extraction evals in `evals/`. Needs `ANTHROPIC_API_KEY` in `.env.local` |

CI runs `typecheck`, `build` and `check:bundle` on every pull request. All must pass before merging.

## Layout

- `src/` is the web app. `src/lib/` holds `board.tsx` (BoardProvider, useBoard, useFeature, roles), `features.ts` (FeatureKey) and `analytics.ts`. `src/features/tickets/` holds ticket types, row mapping and queries. `src/index.css` holds Tailwind v4 (`@import 'tailwindcss';`) and global styles. No Tailwind or PostCSS config file.
- `src/features/transcript/` is transcript matching (V2, `transcript_matching`). `TranscriptPanel.tsx` is loaded with `React.lazy`, and it is the only importer of `TranscriptView.tsx` and the paragraph code, so they stay out of the entry chunk (`check:bundle` enforces it). Keep it that way: never import them statically from the main bundle.
- `src/meetings.ts` and `goldTickets.ts` are CB3 demo data. The app must not import them; only `scripts/make_supabase_seed.mjs` does.
- `evals/` is the extraction and scoring harness (`lib/`, `scripts/`, `prompts/`, `runs/`, `data/`). It is not bundled into the app.
- `supabase/` holds `migrations/`, admin SQL in `scripts/` (run by hand, not migrations) and seeds. `scripts/` holds app-side tooling.
- `docs/` holds `architecture.md` (how it works today), `refactor-spec.md` (scope and decisions) and `ideal-state.md` (V2/V3 vision).
- The page title (`Loopback`) and language are set directly in `index.html`. `.figma/make/site.json` is gone. `vite.config.ts` still carries the Figma Make dev-only plugins; leave them until the spec says otherwise.

## Rules

- One trunk (`main`). Short-lived branches, pull requests, no direct pushes to `main`.
- Nothing board-specific in code. Board name, logo, boundary, ticket types and feature flags come from the database. Do not add `cb3` or `cb9` literals.
- Tenant isolation is enforced by Postgres RLS, not by client filters. Never put a service-role key or any secret in the browser. `VITE_*` variables are public.
- Insert new tickets and update existing ones separately. Send `number: 0` for a new ticket; the database assigns it. A mixed upsert can renumber tickets.
- Migrations are new files only. Never edit an applied migration. Make schema changes additive first, then breaking in a later migration.
- Feature flags resolve through `board_effective_features`. Add keys to `src/lib/features.ts` and read them with `useFeature`. Anything that costs money or touches secrets must also be checked server-side.
- Roles: platform admin (`platform_admins`) and staff (`board_members`). Writes are gated by `can_edit_board()`. Public read access is only through the share-link functions, never `anon` table grants.
- Analytics (`src/lib/analytics.ts`) must never carry ticket content, names, emails, user ids or share tokens.
- Use double quotes for strings containing apostrophes. Export components as default exports.
- No em dashes in code comments, docs or commit messages.
- Secrets live in `.env.local` (git-ignored), Netlify and GitHub secrets.
