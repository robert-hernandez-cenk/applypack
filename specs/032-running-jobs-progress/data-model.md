# Data Model: Live progress card for running jobs

## `cron_run.progress` (new, nullable JSONB)

`NULL` for every finished row and for a running row that never reported. Written only by `recordCronRun`'s reporter; cleared in the update that ends the run.

Parsed on read with the zod schema in `src/jobs/run-progress.ts`; a value that fails the schema is treated as "no progress" (elapsed only).

| Field | Type | Notes |
| --- | --- | --- |
| `stage` | string | stable id: `sources`, `classify`, `mails`; a change forces a write |
| `label` | string | catalog key (`runs.running.stage.*`), resolved at render in the reader's language |
| `unit` | string | catalog key (`runs.running.unit.*`): sources, postings, mails |
| `done` | int ≥ 0, optional | |
| `total` | int ≥ 0, optional | absent = unknown; bar shows no percentage |
| `startedStageAt` | ISO string | when this stage began |
| `updatedAt` | ISO string | when the job last reported (staleness reads this, not the write time) |
| `counters` | record string → int, optional | e.g. `kept`, `setAside`, `classified`, `errors`; `listings` for Gmail |
| `samples` | array of `[done, epochMs]`, max 12 | rate window for the ETA (research R4) |

### Derived values (pure, `run-progress.ts` / `running-view.ts`)

- **fraction** = `min(done, total) / total`, only when `total > 0`.
- **rate** = (last.done − first.done) / (last.at − first.at) over `samples`; none if fewer than 2 samples or no time passed.
- **eta** = `(total − done) / rate`; shown iff `total` known, `done ≥ 20`, rate > 0.
- **stale** = `now − updatedAt > 120 s`; for a row that never reported, `now − startedAt` is not stale-flagged (nothing was promised).
- **elapsed** = `now − cron_run.startedAt`.

### State transitions

```text
RUNNING (progress NULL) --report--> RUNNING (progress {...}) --report--> ...
RUNNING (progress {...}) --finish/fail--> OK | FAILED (progress NULL)
RUNNING (crashed worker) : progress keeps its last value, becomes stale in the card
```

## Unchanged

`cron_run.stats`, `errorMessage`, indexes. No new index: the card reads `status = RUNNING`, a tiny set, via the existing `(startedAt)` index plus filter.
