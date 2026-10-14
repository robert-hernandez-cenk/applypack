# Research: Live progress card for running jobs

Shapes below were read from the code at `origin/main` (72a902c), not invented.

## R1 — Where progress lives

**Decision**: a nullable `progress Json?` column on `cron_run`, written by the job's own process, cleared by `recordCronRun` on finish (success or failure).
**Rationale**: the hourly `fetch` runs in the worker; the dashboard has no access to worker memory (`src/web/fetch-runs.ts` is in-memory in the web process). `cron_run` already holds the `RUNNING` row, is read by `/runs`, and is pruned with it. `stats` is the finished-run record and stays untouched.
**Alternatives**: a new `run_progress` table (extra join, extra cleanup, no gain for one row per run); reusing `stats` (history rows would carry live data and every reader of `stats` would have to ignore it); in-memory + IPC (impossible across the two processes).

## R2 — Live-update mechanism

**Decision**: server-rendered fragment `GET /runs/running`, re-fetched by `public/running.mjs` every 5 s and swapped in; the fragment is empty when nothing runs and the module then stops. `Layout`'s existing `refreshWithoutScript` prop gives the no-script fallback.
**Rationale**: the app has no htmx. Its pattern is a browser module polling a state route (`target-run.mjs`, `fetch-run.mjs`, 2 s) plus `<noscript><meta http-equiv=refresh>` (`layout.tsx:226-231`). A fragment keeps wording, formatting and i18n on the server, so the module needs no catalog keys and no duplicated maths.
**Alternatives**: JSON state + client rendering (duplicates the view and needs `browser.*` keys and a mirror test); whole-page `refresh` (loses scroll, reloads a 100-row table every 5 s).

## R3 — Throttle and failure isolation

**Decision**: `report(p)` is synchronous and returns void. It keeps the latest value in memory and starts a write only when the last write is ≥ 5 000 ms old or `p.stage` changed; at most one write is in flight, and a newer value that arrived meanwhile is sent when it lands. Write errors are caught, logged at `debug`/`warn` once, and dropped. On finish the wrapper waits for the in-flight write, then clears `progress` in the same update that sets the status.
**Rationale**: the classify loop calls `report` per posting (several per second at best); the DB sees one write per 5 s. A late-landing write after the final update must not resurrect `progress` — hence "wait for in-flight, then clear".
**Alternatives**: a timer in the wrapper (a second thing to stop on every exit path); writing on every call (hundreds of UPDATEs for nothing).

## R4 — Rate and ETA

**Decision**: the rate comes from a window of the last N=12 samples (done, at) kept by the reporter, never the average since the start; ETA = (total − done) / rate, shown only when `total` is known and `done ≥ 20`. The samples live in the web view's input, so they must be in the stored JSON: `progress.samples` is a short array of `[done, atMs]` pairs capped at 12.
**Rationale**: a local model's speed changes with load and with the prefilter (cheap rejects are fast); a start-to-now average lies for hours. The web process is stateless between polls, so the window has to ride in the row.
**Alternatives**: client-side sampling in the module (resets on reload, none in the no-script fallback).

## R5 — Counters

**Decision**: report named counters read from `ProcessStats`: `kept` (= `persisted`), `setAside` (= `preFiltered`), `classified`, `errors` (= `classifyFailed`). The issue also lists `fellBack`; **no such counter exists** in `ProcessStats` (grep: none), so it is dropped rather than invented.
**Rationale**: only report what the code already counts.

## R6 — Stages per job

| Job | Stages (key) | unit |
| --- | --- | --- |
| `fetch`, `fetch-now`, `folder-watch` | `sources` → `classify` | sources / postings |
| `gmail` | `mails` (listings as a counter) | mails |
| anything else | none: elapsed only | — |

`SourceProgress` already carries `done` and `total` (`fetchers/index.ts:78`). Stage `classify` begins where `fetch-job` calls `processNormalizedJobs`; `process-jobs` reports its own `done/total`. Labels are keys, not words: the stored `label` is a catalog key resolved at render time (the worker's language is not the reader's).

## R7 — Who sees what

**Decision**: the fragment applies the same `where` as `/runs`: `userId = null` or the current person's. Both routes are personal.
**Rationale**: spec FR-012; ADR 0069/0070 rules.

## R8 — ADR

**Decision**: write ADR 0072 (schema column + cross-process channel + rejected alternatives). Number checked against `docs/adr/` (last is 0071).

## R9 — Tailwind

Utilities used by the card (bar width via inline `style`, `text-warn`, existing tokens) are checked against `src/web/public/tailwind.css`; `npm run css` is rerun and committed only if a class is new.

## Open questions from the issue — resolved

- Live update: fragment polling (R2).
- Throttle 5 s, amber 120 s, ETA floor 20 items, window 12 samples: constants, tunable (spec Assumptions).
- Gmail: mails are the unit; listings are a counter (R6).
