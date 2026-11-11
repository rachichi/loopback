# Loopback handoff

Written 2026-11-11 for whoever takes Loopback over next semester: Block Party, or another Cornell Tech student team. Start with section 1, then read section 8 before anything else ships.

Items marked **TODO (Rachel)** are things only the outgoing owner can fill in (names, links, access). Fill them in before handing this over.

## Contents

1. [What Loopback is and where it is going](#1-what-loopback-is-and-where-it-is-going)
2. [Current state](#2-current-state)
3. [AI automation plans](#3-ai-automation-plans)
4. [Block Party and community boards](#4-block-party-and-community-boards)
5. [Who we have reached out to](#5-who-we-have-reached-out-to)
6. [Boards and environments](#6-boards-and-environments)
7. [Research and demos](#7-research-and-demos)
8. [Urgent: authentication and data backup review](#8-urgent-authentication-and-data-backup-review)
9. [Getting started as the new owner](#9-getting-started-as-the-new-owner)
10. [Access and accounts checklist](#10-access-and-accounts-checklist)
11. [Staying involved](#11-staying-involved)

## 1. What Loopback is and where it is going

NYC has 59 community boards. They hold long public meetings where residents raise problems (a broken streetlight, a liquor license, a bike lane), and the district office is supposed to follow up. Today that follow-up lives in memory, email and spreadsheets, and a lot of it is lost.

Loopback turns meetings into tracked follow-up work. A meeting transcript goes in; a reviewed list of tickets comes out, each tied to the words in the meeting that support it, to the places it concerns, and to its history across meetings. Staff review everything. The AI drafts, people decide.

The longer vision is that a board's whole communication loop runs from the same ticket data:

- Meeting happens, transcript arrives, tickets are drafted and reviewed.
- Minutes and resolutions are drafted from the same meeting.
- Resolved tickets feed newsletters and social posts ("you asked, we got it done").
- Residents can see public progress through a read-only share link.

One codebase and one database serve every board. Board name, logo, boundary, ticket types and feature flags are data, not code.

Read these in order for depth:

| Doc | Use it for |
| --- | --- |
| [`ideal-state.md`](ideal-state.md) | The product vision (written for the CB3 prototype, so file paths in it are stale) |
| [`architecture.md`](architecture.md) | How the app works today |
| [`refactor-spec.md`](refactor-spec.md) | Scope by version, data model, security, rollout. Wins when docs disagree. |
| [`telemetry.md`](telemetry.md) | Analytics events. Required reading before turning a feature on for a real board. |
| [`../AGENTS.md`](../AGENTS.md) | Commands, layout and rules for contributors |

## 2. Current state

Scope is split by version in `refactor-spec.md` section 2.

- **V1, usable ticketing MVP:** staff log and edit tickets, map of the district, public read-only share link, invite-only staff accounts, per-board isolation with Postgres row-level security. Live.
- **V2, pasted-transcript workflow:** transcript matching (`match-transcript` Edge Function), Meetings tab, AI-drafted minutes (`generate-minutes`). Behind feature flags, enabled on the `staging` board only.
- **V3, automated sources and assets:** Block Party API sync, social posts, resolutions, newsletters, self sign-up. Mostly not built. Prompt work for resolutions exists in `evals/prompts/resolutions/`.

Project tracking is in Linear, workspace `loopbackcb`, team Web App (key `WA`). Projects mirror the versions: V0 Product Studio Milestones (course work), V1 Usable Ticketing MVP, V2 Configurable Pasted-Transcript Workflow, V3 Automated Source Integrations. The old Airtable Tasks table was replaced on 2026-11-03 and the history was backfilled as WA-98 to WA-187. Airtable remains only for annotation and eval data. Check for an existing WA issue before creating one.

## 3. AI automation plans

The pattern is the same everywhere: a versioned prompt, a scorer that measures it against staff-approved answers, a server-side function that calls the model, and a human review step before anything leaves the building.

| Workflow | Status | Where |
| --- | --- | --- |
| Meeting transcript to tickets | Working on staging. Evals scored on CB3 and CB9 data. | `evals/prompts/tickets/` (v1 to v7), `evals/lib/`, `match-transcript` function |
| Meeting minutes | First version on staging. Boards must post minutes within two weeks of a meeting. | `evals/prompts/minutes/`, `generate-minutes` function, `pnpm evals:minutes` |
| Resolutions and the letters that send them | Prompt drafted, not wired into the app | `evals/prompts/resolutions/resolutions-v1.md` |
| Newsletters | Idea stage. Source material would be resolved tickets plus minutes. | Not started |
| Social media outreach | Idea stage. Same source material, shorter formats, human approval per post. | Not started |

Principles to keep:

- Reuse the existing pipeline. Split the transcript into numbered paragraphs, have the model cite paragraph ids as evidence, validate the ids in code. Extend `evals/` (new prompt version, new schema field) rather than building a parallel path.
- The eval harness is demo-grade. The default model for runs was Haiku, chosen for cost, and status-field errors were considered acceptable. Revisit this bar before any board relies on the output.
- Anything that costs money or touches secrets is checked server-side, not by a client flag. The Anthropic key lives only in Edge Function secrets.
- Staff review every AI output. Corrections should flow back into the eval set so prompt changes are measured against what staff actually accept.
- Held-out data: CB3 train2 gold was labeled after reading a model draft, so its scores are inflated. Label any new test set before showing model drafts.

## 4. Block Party and community boards

**Block Party** hosts and transcribes community board meetings. We collaborate with them because they hold the transcripts Loopback needs and have relationships with boards.

- Today transcripts are loaded by hand (`scripts/load_meetings.mjs`). The `meetings` table columns were designed to map onto Block Party's meetings table so a later sync can fill it.
- Whether Block Party exposes the API the sketch assumes is **unverified**. The code keeps a `TranscriptSource` seam so the source can change without rewrites.
- The Block Party key must never reach the browser.
- If Block Party takes over the project, the sync becomes much simpler, and the open question is whether Loopback stays a standalone product or becomes a Block Party feature.

**Community boards** are the users. Staff at a district office review tickets against the transcript and a map of their district. Requirements that came out of those conversations: invite-only accounts, nothing public by default, administrative tickets hidden from the public share view, and minutes within two weeks of each meeting.

**TODO (Rachel):** add the Block Party contact(s), what was agreed, and anything promised either way.

## 5. Who we have reached out to

**TODO (Rachel):** fill in this table from your notes and email. I did not have this information, so nothing below is filled in.

| Who | Org or board | Role | Date | Channel | Outcome and next step |
| --- | --- | --- | --- | --- | --- |
| | Block Party | | | | |
| | Brooklyn CB9 | | | | |
| | Manhattan CB3 | | | | |
| | Other boards | | | | |

Also list anyone you meant to contact but have not, and anyone who asked not to be contacted.

## 6. Boards and environments

| Board id | What it is |
| --- | --- |
| `b-cb-9` | **Brooklyn Community Board 9. The one active board.** Real staff use it. Treat its data as production. |
| `staging` | "Staging Board". Every feature flag on. Copies CB9's borough, boundary and ticket types. Use it to try V2 and V3 features before any real board gets them. No share link, no staff. |
| Other 58 boards | Exist as rows, not onboarded. |

Rules that follow from this:

- Try new features on `staging` first. Staging is exempt from the telemetry requirement; any other board is not. Before a major feature is on for another board, add its events to `src/lib/analytics.ts` and list them in `docs/telemetry.md` in the same pull request.
- `staging` is a board inside the same database, not a separate environment. All environments currently share one Supabase project. A separate staging project is planned (`refactor-spec.md` section 9, step 9) and not done.
- Seed data for staging: `supabase/scripts/create_staging_board.sql`, `seed_staging_tickets.sql`, and `node scripts/load_meetings.mjs staging evals/data/b-cb-9/raw_*.txt`.
- Nothing board-specific goes in code. No `cb3` or `cb9` literals.

## 7. Research and demos

**Research folder (Google Drive, read-only):** <https://drive.google.com/drive/folders/1jC8vbo04FrzNMkTpqonnXBiR7GfYBTSO?usp=sharing>

Everything else (research, demos, supporting files) is in this folder. Confirm the sharing setting stays "Anyone with the link: Viewer".

**TODO (Rachel):** add a line on what is in the folder and what to open first, so a new team is not guessing.

**Demo videos:** These are in the Drive folder above. **TODO (Rachel):** list each demo with title, what it shows and date.

| Demo | What it shows | Date |
| --- | --- | --- |
| | | |

In-repo material:

- Landing page at `/landing` with fake demo data (`src/features/landing/`), with a contact form on Netlify Forms.
- CB3 and CB9 transcripts, gold tickets and official minutes under `evals/data/`. These come from public meetings, but check with Block Party before redistributing the transcripts.

## 8. Urgent: authentication and data backup review

**Do this before adding a second active board or any new real user.** These were built to reach a usable MVP, not hardened, and nobody has done a full review.

### Authentication

- Accounts are invite-only email and password through Supabase Auth, with open sign-up supposed to be disabled. **Verify in the dashboard that sign-up is actually off in production.**
- Platform admins (`platform_admins`) can do anything across boards. List them and confirm each is intended.
- `create_board_test_staff.sql` writes to `auth.users` directly and uses plus-addressed test accounts. Confirm those test accounts do not exist in production, or that their passwords are strong and not committed anywhere.
- Built-in Supabase email only reaches the project team. Inviting real staff by email needs custom SMTP, which is not set up. Password reset and invite flows should be tested end to end.
- Consider MFA for platform admins and a plan for staff who leave a board.
- Self sign-up (`@cb.nyc.gov` email or city SSO) is deferred to V3. It needs a deliberate security design, not a toggle.
- Re-run the cross-board isolation test in `refactor-spec.md` (section on RLS verification) after any policy or migration change. One migration (`drop_demo_policies`) was applied by hand, so confirm in production that no `demo` or `anon` table policies remain.

### Data backup

- Production runs on a Supabase **free plan** project, which the docs flag as unsuitable once real staff depend on it: it pauses after inactivity (a daily keep-alive GitHub workflow works around this and is not a guarantee), and free projects do not include the managed backup guarantees of paid plans. **Confirm the current plan and what backups actually exist, and whether a restore has ever been tested. I have not verified this.**
- The keep-alive workflow needs repo secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). If the repo owner changes, these must move too.
- Recommended minimum: upgrade production to a paid plan, turn on scheduled backups (and point-in-time recovery if the budget allows), do one real restore into a scratch project, and write down the steps. Also keep an off-platform periodic `pg_dump` of tickets, meetings and boards, plus a copy of the Storage bucket (logos, boundaries).
- Migrations are in `supabase/migrations/`, but admin scripts in `supabase/scripts/` are run by hand and some changes were applied outside migration history (see `supabase/README.md`). The repo alone cannot rebuild production. Check `supabase migration list` before every `db push`.
- Keep a record of who holds the Supabase, Netlify, GitHub, Anthropic and Better Stack owner roles. If one person's account is the only owner of anything, that is a backup problem too.

## 9. Getting started as the new owner

```bash
pnpm install
cp .env.example .env.local   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
pnpm dev
```

Needs Node 22.12+ and pnpm 10. CI runs `typecheck`, `build` and `check:bundle` on every pull request; all must pass. `main` is the only trunk: short-lived branches and pull requests, no direct pushes.

Rules worth repeating (full list in `AGENTS.md`):

- Tenant isolation is Postgres RLS, not client filters. Never put a service-role key or any secret in the browser; `VITE_*` variables are public.
- Migrations are new files only. Never edit an applied one. Additive first, breaking later.
- Insert new tickets and update existing ones separately. Send `number: 0` for new tickets.
- Analytics must never carry ticket content, names, emails, user ids or share tokens.
- Feature flags resolve through `board_effective_features`; add keys to `src/lib/features.ts`.
- `src/meetings.ts` and `goldTickets.ts` are CB3 demo data and must not be imported by the app.

## 10. Access and accounts checklist

Transfer or add the new owners to each, then remove access that should not continue. **TODO (Rachel):** mark who currently holds each.

- [ ] GitHub repository (owner or admin)
- [ ] Supabase organization and production project
- [ ] Netlify site (env vars per deploy context, Forms notification recipients)
- [ ] Linear workspace `loopbackcb`
- [ ] Airtable base (annotation and eval data)
- [ ] Better Stack (analytics token)
- [ ] Anthropic API key (Edge Function secrets and evals); rotate on handoff
- [ ] Block Party API access, if any
- [ ] Google Drive research folder (read-only for new team)
- [ ] Domain names, if any were registered
- [ ] Platform admin rows in `platform_admins`

Rotate any key that has passed through chat, email or a shared doc. Secrets belong in `.env.local`, Netlify and GitHub secrets only.

## 11. Staying involved

Rachel will stay on the project as an advisor after handing over day-to-day ownership. Suggested arrangement, to agree with the incoming team:

- Rachel stays as an advisor and reviewer, with read access to the repo and Linear, and keeps the relationships listed in section 5 until they are introduced to the new owners.
- Warm introductions to Block Party and Brooklyn CB9 happen in the first two weeks, in person or on a call, not by forwarding this document.
- Rachel keeps ownership of an agreed item (for example the AI workflows in section 3) or is on call for questions. **TODO (Rachel):** decide and state it.
- Contact: rl996@cornell.edu
