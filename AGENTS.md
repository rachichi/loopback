# Loopback

Ticket tracker for NYC community boards. Staff review tickets from board meetings against the transcript and a map of the district. React 19, Vite, Tailwind CSS v4, Supabase (Postgres, Auth, RLS).

`docs/refactor-spec.md` is the source of truth for scope, data model, security and rollout. Read it before changing the data layer, auth, or feature flags. Version scope (V1 purple, V2 blue, V3 green) is in its section 2.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm typecheck` | `tsc --noEmit` over `src/` and `vite.config.ts` |
| `pnpm build` | Production build to `dist/` |
| `pnpm format` | oxfmt |
| `pnpm evals:run`, `evals:score`, `evals:log` | Extraction evals in `evals/`. Needs `ANTHROPIC_API_KEY` in `.env.local` |

CI runs `typecheck` and `build` on every pull request. Both must pass before merging.

## Layout

- `src/` is the web app. `src/index.css` holds Tailwind v4 (`@import 'tailwindcss';`) and global styles. No Tailwind or PostCSS config file.
- `evals/` is the extraction and scoring harness (`lib/`, `scripts/`, `prompts/`, `runs/`, `data/`). It is not bundled into the app. The app currently imports a few files from `evals/data/` as bundled sample data; the spec removes that.
- `supabase/` holds migrations and seeds. `scripts/` holds app-side tooling.
- `docs/` holds the spec and the target architecture.
- `vite.config.ts` still carries Figma Make dev-only plugins and reads `.figma/make/site.json` for the page title. Leave them until the spec says otherwise.

## Rules

- One trunk (`main`). Short-lived branches, pull requests, no direct pushes to `main`.
- Nothing board-specific in code. Board name, logo, boundary, ticket types and feature flags come from the database. Do not add `cb3` or `cb9` literals.
- Tenant isolation is enforced by Postgres RLS, not by client filters. Never put a service-role key or any secret in the browser. `VITE_*` variables are public.
- Insert new tickets and update existing ones separately. Send `number: 0` for a new ticket; the database assigns it. A mixed upsert can renumber tickets.
- Migrations are new files only. Never edit an applied migration. Make schema changes additive first, then breaking in a later migration.
- Feature flags resolve through `board_effective_features`. Anything that costs money or touches secrets must also be checked server-side.
- Use double quotes for strings containing apostrophes. Export components as default exports.
- No em dashes in code comments, docs or commit messages.
- Secrets live in `.env.local` (git-ignored), Netlify and GitHub secrets.
