# Project conventions

> Pair with [SPEC.md](./SPEC.md) (current state) and
> [ARCHITECTURE.md](./ARCHITECTURE.md) (data flow + file map).

## Stack

- TypeScript strict mode, Node 24 (runtime image; engines allow >=22)
- Prisma + Postgres 16 (already in docker-compose)
- Native fetch (no axios). Use AbortController for timeouts (10s default via `fetchWithRetry`).
- pino for logs (never console.log in production code)
- zod for ALL external data: env vars, API responses, Claude output

## Code style

- No default exports. Named exports only.
- Pure functions where possible. Side effects (DB, HTTP, Telegram) isolated to dedicated modules.
- async/await, never raw promise chains.
- Errors: throw typed errors with context. Caller decides logging.
- No magic numbers. Constants at top of file or in config.ts.

## Testing

- `npm test` runs Node's built-in test runner across `src/**/*.test.ts`.
- Tests cover **pure modules only** (filter, text-utils, http, hn-parser,
  notifier helpers, stale-applications-format, fetcher mappers, prefilter
  parser). Modules that import Prisma or the Anthropic SDK are NOT
  unit-tested — they're verified via smoke runs (`npm run fetch:once`
  etc.) and integration testing through the dashboard.
- Adding a test: extract the pure piece into a separate file if needed
  (we did this for `formatStaleMessage`, `parsePrefilterResponse`,
  `decideStageStrategy`, `mapXFeed` mappers). The unit-test file lives
  next to the source as `*.test.ts`.
- CI runs `npm run lint:types` (`tsc --noEmit`) + `npm test` on every
  push and PR, around three gates: `npm audit --omit=dev --audit-level=high` (a fix the parent package has not shipped goes in
  `overrides` — deepmerge-ts 8 under prisma 6 today, GHSA-ggr8-5vv4-36mx;
  drop it once prisma releases the fix), `npm run exports:audit` (a dead or
  over-exported export fails) and `src/env-example.test.ts` (`.env.example`
  against `config.ts` and every `process.env` read). It then migrates a
  Postgres service, fails when `prisma migrate diff` finds the schema and
  the migrations apart, and runs the **route
  smoke** (`npm run smoke:routes` after `npm run build` —
  `src/scripts/route-smoke.ts`): fixtures in, every GET route one
  in-process request through `app.request()`, the first run's POSTs, a
  cross-origin POST refused, one clean PDF render, a file of rows through its
  preview and its import, then every page again in the pseudo-language, where
  one run of English outside the catalog fails the build as a 500 does (ADR
  0061, #356). Run it locally on a throwaway database only — it inserts rows and
  switches employer mode on (see `.github/workflows/test.yml`).
- The `local-start` job runs the default install on Linux (Node 22 and 24),
  macOS and Windows: `npm start` with a temporary `APPLYPACK_DATA_DIR`, the
  route smoke against the built-in database, `npm run stop`, nothing left.
  The `docker` job builds the image (never pushed), so the server option
  cannot rot between releases. `.github/dependabot.yml` opens the weekly
  update PRs: minor and patch together, each major on its own.

## Running

- `npm start` is the default install (ADR 0054): `npm run build` (tsc + the
  PDF fonts into `dist/`), then `dist/local/launcher.js`. Data lives in the OS
  app-data folder (`APPLYPACK_DATA_DIR` moves it). `npm run db` runs the
  database alone; `npm run stop` stops a running launcher.
- Docker is the server option and does not use the launcher: compose sets
  `DATABASE_URL` and runs `node dist/index.js` / `node dist/web/server.js`.
  `NODE_ENV=production` there makes the logs JSON (`logger.ts`); both
  services carry a healthcheck, `node dist/scripts/health-check.js web|worker`
  (`/health` with the Basic Auth credentials, or the age of the worker's
  `HEARTBEAT_FILE` — `src/heartbeat.ts`).
- Multi-stage Dockerfile: `deps → build → runtime`; `npm ci` from the
  lockfile, the build stage prunes the dev dependencies and deletes the
  built-in database's binaries, and the three CLI engines are pinned
  (`ARG CLAUDE_CODE_VERSION` …) — bump them together.
- Runtime image: `node:24-alpine`.
- `init.ts` runs `prisma migrate deploy` if `prisma/migrations/` exists,
  else falls back to `prisma db push`. Real migrations exist from
  `phase-3.0` onward.
- Use `.dockerignore` to exclude `node_modules`, `.env`, `dist`, `.git`.

---

## ATS templates (when adding a new source)

Reference patterns, one per feed shape — copy whichever fits the new source:

| Shape of the new ATS                                     | Reference file                             | Examples                                                                                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single curated RSS                                       | `src/fetchers/larajobs.ts`               | RSS one feed for the whole site, no per-company config                                                                                                                            |
| RSS whose title carries the structure, one row per query | `src/fetchers/dou.ts` + `dou-title.ts` | atsToken = the feed's query string; a pure title-grammar parser; fetched with the project UA because the board blocks rss-parser's                                                |
| RSS whose LOCATION lives in the filter, not the items    | `src/fetchers/djinni.ts`                 | atsToken = the filter string; `djinniPlace(token)` writes the location + hints from it; rows whose category ≠ the requested keyword are the bare-feed fallback and are dropped |
| Per-category RSS, atsToken = category slug               | `src/fetchers/weworkremotely.ts`         | Same pattern, atsToken changes per Company row                                                                                                                                    |
| Single JSON aggregator                                   | `src/fetchers/remotive.ts`               | One feed, structured JSON, all jobs under one synthetic Company                                                                                                                   |
| Per-company GET JSON                                     | `src/fetchers/ashby.ts`                  | atsToken = company slug, GET endpoint, no auth                                                                                                                                    |
| Per-company POST JSON (no description in list)           | `src/fetchers/workable.ts`               | POST with body, list-only data                                                                                                                                                    |
| Per-company list + per-job detail                        | `src/fetchers/smartrecruiters.ts`        | List + N detail fetches with rate limit                                                                                                                                           |

Always:

1. Add the new value to `AtsType` enum in `prisma/schema.prisma`
2. `npx prisma migrate dev --name add_<X>` to generate the migration
3. Wire into `src/fetchers/index.ts:fetchOne` switch
4. Add ONE reference board to `src/seed.ts`, `active: false` (the seed ships no employer board on — curated ones go to `src/starter-packs/catalog.json`, ADR 0040)
5. Extend `src/text-utils.ts:extractAtsToken` if discoveryEnabled should pick up URLs from this ATS
6. Extend `src/ats-probe.ts:probeAts` if the new ATS is per-company (so manual /companies add validates tokens)
7. Add a unit test for the pure mapper if you have a `mapXFeed(parsed, companyId)` helper
8. An aggregator (one row, many employers) sets `employer` from the feed's own field through `cleanEmployer` — `null` when the feed does not say, never the aggregator's name (ADR 0056); a per-company source leaves it out

---

## Common operational tasks (one-line answers)

| Task                                                     | Command                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run ApplyPack without Docker                             | `npm start` (Ctrl+C or `npm run stop` to stop); for watchers `npm run db` + `npm run dev` + `npm run dev:web`                                                                                                                                                               |
| Back up a local install                                  | automatic: `snapshots/<date>` in the data folder, the newest three; for a copy elsewhere stop it and copy the data folder (`~/Library/Application Support/ApplyPack`, `%APPDATA%\ApplyPack`, `~/.local/share/applypack`)                                                      |
| Move a Docker install into `npm start`                 | on Docker: `docker compose exec -T postgres pg_dump -U jobhunter --data-only --inserts --column-inserts jobhunter > data.sql`; here, with only `npm run db` running: `npm run db:import -- data.sql --yes`                                                                      |
| Test the launcher on a scratch folder                    | `APPLYPACK_DATA_DIR=/tmp/ap WEB_PORT=4848 APPLYPACK_NO_OPEN=1 npm start` — never the live data folder                                                                                                                                                                              |
| Run one fetch tick now                                   | UI: Overview → "Fetch now" (live progress, row on `/runs`; runs outside the schedule, and while paused stores the jobs unscored); or `docker compose exec app node dist/scripts/fetch-once.js`, which does the same without the dashboard and is recorded as a `fetch-now` run |
| Run discovery probe now                                  | `docker compose exec app node dist/scripts/discovery-once.js`                                                                                                                                                                                                                       |
| Pull HN Who-is-hiring now                                | `docker compose exec app node dist/scripts/hn-once.js`                                                                                                                                                                                                                              |
| Run the application-pack queue now                       | `docker compose exec app node dist/scripts/pack-once.js` (the worker does this every minute; recorded as a `pack` run)                                                                                                                                                            |
| Read every connected person's Gmail label now            | `docker compose exec app node dist/scripts/gmail-once.js` (the worker does this hourly, and every minute for a "Check now"; one `gmail` run per person)                                                                                                                           |
| Send the stale-applications digest now                   | `docker compose exec app node dist/scripts/stale-once.js`                                                                                                                                                                                                                           |
| Send 4 test Telegram messages                            | `npm run test:telegram` (locally, .env loaded)                                                                                                                                                                                                                                      |
| Tail the worker                                          | `docker compose logs -f app` (JSON; add `--no-log-prefix … \| npx pino-pretty` for lines)                                                                                                                                                                                         |
| Tail the dashboard                                       | `docker compose logs -f web`                                                                                                                                                                                                                                                        |
| psql into the DB                                         | `docker compose exec postgres psql -U jobhunter -d jobhunter`                                                                                                                                                                                                                       |
| psql / Prisma from the HOST                              | port **5433** (`postgresql://jobhunter:jobhunter@localhost:5433/jobhunter`) — compose publishes the DB on loopback only, on 5433 so a host Postgres on 5432 cannot shadow it                                                                                                 |
| Back up the database                                     | `docker compose exec -T postgres pg_dump -U jobhunter jobhunter > applypack-$(date +%F).sql` (verified: 8.7 MB, 16 tables; restore into an empty DB with `psql < dump`)                                                                                                           |
| Re-clean stored descriptions (rows with leftover markup) | `docker compose exec app node dist/scripts/backfill-descriptions.js --dry-run`, then without the flag                                                                                                                                                                               |
| Fingerprint existing jobs + link cross-listings          | `docker compose exec app node dist/scripts/backfill-fingerprints.js --dry-run`, then without the flag                                                                                                                                                                               |
| Flag apply links on already-stored jobs                  | `docker compose exec app node dist/scripts/backfill-apply-link-flags.js --dry-run`, then without the flag                                                                                                                                                                           |
| Re-pull descriptions from the boards (structure lost)    | `docker compose exec app node dist/scripts/refetch-descriptions.js --dry-run`, then without the flag                                                                                                                                                                                |
| Migrate after a schema change                            | `DATABASE_URL=… npx prisma migrate dev --name <name>`                                                                                                                                                                                                                              |
| Re-classify everything against the active profile        | UI: `/settings` → Job search → "Save & re-classify"                                                                                                                                                                                                                               |
| Pause all alerts temporarily                             | UI: `/settings` → Notifications → "Alerts" → Disable (what is found meanwhile waits, then arrives in one message per chat)                                                                                                                                                       |
| Pause new-job fetching entirely (no docker)              | UI: `/settings` → Job search → "Automatic job search" → Pause, or the Pause button in the Overview header                                                                                                                                                                        |
