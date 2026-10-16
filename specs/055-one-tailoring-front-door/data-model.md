# Data Model: One tailoring front door

## Resume (changed)

- **Removed field**: `hidden Boolean @default(false)` — the scratch-row flag.
- **Migration** `20261016090000_remove_scratch_resume`: delete rows with `hidden = true` (dependants cascade; see research R1), then `ALTER TABLE "Resume" DROP COLUMN "hidden"`.
- **Invariant after**: every `Resume` row is a visible, listable resume. No query filters on `hidden`.

## ResumeMatch (unchanged shape)

- `breakdown` JSON keeps its markers: `pages` (page target, ADR 0074), `mode`, `evidence` (`own` | legacy `text`), `verificationId`.
- New rows always write `evidence: 'own'`. Legacy rows keep `text`; `readMatchEvidence` reads both.
- The `resumeName` / `resumeText` / `draft` snapshot columns stay (a saved resume's comparison still snapshots its name and the judged text); only the scratch-row interpretation of them is removed.

## Run (in memory, unchanged)

- `target-runs.ts` registry; default `backUrl` changes from `/target` to `/jobs`.

## Not changed

`Job`, `UserJob`, `CoverLetter`, `ResumeReview`, `CandidateFact`, settings.
