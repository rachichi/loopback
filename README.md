# Loopback

Loopback turns community board meetings into tracked follow-up work. District office staff review tickets from a meeting against the meeting's transcript and a map of the district.

One codebase serves many boards. A board's name, logo, boundary, ticket types and enabled features live in the database, and Postgres row-level security keeps each board's tickets separate.

## Where things are

| Doc | What it covers |
| --- | --- |
| [`docs/refactor-spec.md`](docs/refactor-spec.md) | Scope by version, data model, auth and RLS, rollout order, open decisions |
| [`docs/architecture.md`](docs/architecture.md) | Target architecture and workflow (aspirational, written before the multi-board design) |
| [`supabase/README.md`](supabase/README.md) | Migrations and how they were applied |
| [`AGENTS.md`](AGENTS.md) | Commands, layout and rules for contributors and coding agents |

## Develop

```bash
pnpm install
cp .env.example .env.local   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
pnpm dev
```

`pnpm typecheck` and `pnpm build` run in CI on every pull request.

## License

MIT, see `LICENSE`.
