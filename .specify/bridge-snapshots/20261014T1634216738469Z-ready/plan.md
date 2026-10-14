# Implementation Plan: Live progress card for running jobs

**Branch**: `issue-32-running-jobs-progress` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-running-jobs-progress/spec.md` (GitHub issue #32)

## Summary

A running job writes small progress reports into its own `cron_run` row (new nullable `progress` JSON column). `recordCronRun` hands the job a throttled, failure-proof `report(p)`; the wrapper clears `progress` when the run ends. The Runs page gets a "Running now" card, rendered on the server from those rows, and a tiny browser module re-fetches the card's fragment (`GET /runs/running`) every 5 s. The classify loop, the source walk and the Gmail read are instrumented; every other job shows name and elapsed time. The pure maths (schema, throttle, rate, ETA, staleness) lives in `src/jobs/run-progress.ts`.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: Prisma 6 + Postgres 16, zod, Hono + `hono/jsx`, pino — nothing new

**Storage**: one nullable `progress Json?` column on `cron_run`; hand-written migration after `20261014120000_gmail_job_leads`

**Testing**: `node --test` over `src/**/*.test.ts`; pure modules only (`run-progress.ts`, the card view, `running.mjs` via `import()`), route smoke for the fragment route

**Target Platform**: worker (writes) and dashboard (reads), separate processes sharing Postgres

**Project Type**: web service + cron worker (existing split; the worker still runs no HTTP server)

**Performance Goals**: at most one progress UPDATE per run per ~5 s; the fragment is one small query

**Constraints**: a progress write never fails or delays a job; no polling when nothing runs; no build step for browser code; every new i18n key in every catalog (`catalog.test.ts`); the pseudo-language smoke finds no English outside the catalog

**Scale/Scope**: a handful of concurrent running rows; about a dozen UI strings; 3 instrumented jobs

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so the gate is the repo's `CLAUDE.md`:

| Rule | Status |
| --- | --- |
| Worker runs no HTTP server | Pass — the worker only writes a DB column |
| Pure logic in its own tested file; side effects isolated | Pass — `run-progress.ts` pure; the DB write stays in `cron-run.ts` |
| zod for external data | Pass — `progress` JSON is parsed with a schema on read; a malformed value is dropped, not rendered |
| Named exports only; no magic numbers | Pass — constants at the top of `run-progress.ts` |
| Every user-visible string a catalog key, all languages | Pass — `runs.running.*` keys in en/es/fr/uk |
| New route in exactly one of `ADMIN_ROUTES` / `PERSONAL_ROUTES` | Pass — `GET /runs/running` beside `GET /runs` (personal) |
| `exports:audit` (no dead or over-exported export) | Watch — export only what another file imports |
| ADR for schema/architecture changes | Needed — ADR 0072 (a schema column and a cross-process channel) |

Re-check after design: unchanged, no violation to justify.

## Project Structure

### Documentation (this feature)

```text
specs/032-running-jobs-progress/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/runs-running.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
prisma/schema.prisma                                   # CronRun.progress Json?
prisma/migrations/20261014150000_cron_run_progress/    # ALTER TABLE cron_run ADD COLUMN progress JSONB
src/jobs/run-progress.ts (+ .test.ts)                  # NEW, pure: schema, throttle, rate/ETA, staleness
src/jobs/cron-run.ts                                   # report() passed to fn; progress cleared at finish
src/jobs/process-jobs.ts                               # ProcessOptions.report; classify loop reports
src/jobs/fetch-job.ts                                  # FetchJobOptions.report; sources stage via onSource
src/jobs/fetch-tick.ts                                 # fetch / folder-watch pass report through
src/jobs/gmail-job.ts, gmail-live.ts, gmail-tick.ts    # mails stage; listings counter
src/jobs/for-each-user.ts                              # hands report on (gmail goes through it)
src/web/running-view.ts (+ .test.ts)                   # pure: row -> card view (percent, labels, stale)
src/web/pages/running-card.tsx                         # RunningCard (hono/jsx), shared by page and fragment
src/web/pages/runs.tsx, routes/runs.tsx                # card between funnel and history; GET /runs/running
src/web/public/running.mjs (+ src/web/running.test.ts) # NEW: poll the fragment, swap, stop when empty
src/i18n/catalog/{en,es,fr,uk}.json                    # runs.running.* keys
src/users/admin-policy.ts                              # 'GET /runs/running' in PERSONAL_ROUTES
src/scripts/route-smoke.ts                             # fragment request, with and without a running row
src/web/public/tailwind.css                            # npm run css if new utilities appear
docs/adr/0072-*.md, docs/where-to-look.md, ARCHITECTURE.md, SPEC.md, CLAUDE.md (one file-rules line)
```

**Structure Decision**: extend the existing worker/web split; the `cron_run` row is the cross-process channel (the web process cannot see worker memory). No new module outside `jobs/` and `web/`.

## Complexity Tracking

No constitution violations to justify.
