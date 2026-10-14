# 0072 — A running job reports its progress through its own run row

**Status:** Accepted (2026-10-14). Issue #32. Builds on [0003](./0003-no-queue-just-node-cron.md)
(one worker, no queue, node-cron), [0069](./0069-settings-chats-and-mutes-belong-to-a-person.md) (a run row is the
install's or a person's) and [0070](./0070-administrators-run-the-install-members-work-in-their-own-space.md)
(every route is administrators' or personal).

## Context

The hourly `fetch` runs in the worker and can take hours when a local model scores the postings (663
postings at about 3 a minute ran 2.5 h). `/runs` showed it only as `Running`: `recordCronRun` wrote
`stats` at the end, and the dashboard is another process that cannot see the worker's memory. The one
live view, "Fetch now", is an in-memory object of the web process (`fetch-runs.ts`) and exists only for
runs the web process started.

## Decision

- **The run row carries the progress.** `cron_run.progress` (nullable JSONB): stage, a label and a
  unit (both catalog keys, because the worker's language is not the reader's), `done` / `total`, when
  the stage began and when the job last reported, named counters, and up to 12 `[done, time]` samples.
  `stats` stays the finished-run record. The wrapper sets `progress` to null in the update that ends
  the run, success or failure, so history rows are unchanged.
- **A job reports through a callback, never a write.** `recordCronRun` hands `fn` a `report(p)` that
  is synchronous and cannot throw (`jobs/run-progress.ts:createReporter`): at most one write in flight,
  at most one write every 5 s inside a stage, a change of stage always written (held for the write in
  flight), a failed write logged at debug and dropped. The wrapper awaits the write in flight before
  the final update, so a late write cannot put the progress back. A job that never calls it behaves as
  before; the classify loop, the source walk and the Gmail read call it, every other job shows its name
  and elapsed time.
- **The estimate is the recent rate.** The samples span minutes (one per 30 s, 12 kept), so the time
  left follows what the model is doing now, not the average since the start; it is hidden below 20
  items and reads "no estimate" when there is no total.
- **Staleness is the answer to a crashed worker.** The card shows the age of the last report and turns
  amber past two minutes. A reaper for rows left `RUNNING` by a crash is not part of this.
- **The dashboard polls a fragment.** `GET /runs/running` is the card rendered on the server (personal
  route: the install's runs and the person's own, as `/runs`); `public/running.mjs` swaps it in every
  5 s while the tab is visible, stops when it comes back empty, and without script the page reloads
  itself every 30 s while a run is going.

## Considered and rejected

- **A `run_progress` table.** One more join and one more cleanup for a value that lives as long as its
  row.
- **Progress inside `stats`.** Every history row and every reader of `stats` would carry or have to
  ignore live data.
- **Moving "Fetch now" onto this.** Its page is a guided walk with its own steps; not worth the risk
  here. It may use the same row later.
- **Client-rendered JSON polling.** It would need the card's wording duplicated in the browser catalog
  and a mirror test; a server fragment keeps one rendering.
- **A timer in the wrapper to write on a schedule.** A second thing to stop on every exit path.

## Consequences

- One nullable column; the migration is a bare `ADD COLUMN`.
- A job that wants to be watched adds `report({...})` calls with catalog keys; a key this build does
  not know is left out of the card, not shown raw.
- A worker that dies leaves its last report on the row until something else ends it; the card says so
  by turning amber.
