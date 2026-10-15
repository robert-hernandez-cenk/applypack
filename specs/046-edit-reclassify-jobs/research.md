# Research: Edit a job's details and re-classify it

## R1 — Who may edit

- **Decision**: editable when the signed-in person holds a `user_job` row and no one else does (`count(user_job where jobId) === 1`). Checked on the GET (to show the form), on the POST, and again in the store immediately before the write.
- **Rationale**: `Job` is the shared catalog (ADR 0065/0067). There is no `ownerId` column — "pasted / imported postings are their adder's only" is expressed by the adder being the only row holder. The rule covers Gmail, paste, import and folder with no new notion, and protects boards and aggregators automatically.
- **Alternatives**: a new `Job.ownerId` column (migration, backfill, still needs a rule for rows with several holders); administrators override (rejected: an admin editing a posting others rely on is the harm the rule prevents).
- A non-holder already gets "not found" from `web/job-guard.ts:requireHeldJob` for every `/jobs/<id>/…` path, including the new ones.

## R2 — Description edit

- **Decision**: extract the three columns `refreshDescription` writes — `description`, `descriptionOriginal` (first original kept), `descriptionRefreshedAt` — plus `descriptionSimhash` into an exported `descriptionColumns(job, text)` in `description-refresh.ts`; the swap and the edit both call it. The edit does one `prisma.job.update` for all changed fields, then one classifier call.
- **Rationale**: calling `refreshDescription` from the edit would classify twice when other fields also changed. Sharing the column definition keeps "Restore the original" working unchanged (it reads `descriptionOriginal`) and `keyword-frame.ts` sees `descriptionRefreshedAt` and rebuilds keywords (FR-008).
- Text is passed through `normaliseDescription` (same as every description change); "changed" is judged on the normalised text.
- **Limits**: `MIN_DESCRIPTION_CHARS` (200) and `MAX_POSTING_CHARS` apply **only when the description changed**; saving a new location on a short Gmail description must not demand 200 characters of an untouched field. Title: 1–300 chars after trim; company ≤ 200; location ≤ 300 (may be empty, the column is non-null).

## R3 — Company

- **Decision**: the form edits `Job.employer`; the store writes `employerKey = hiringKey(employer, company.name, aggregator)` with `aggregator = !sourceIsEmployer(atsType)`, the same function every insert uses. Pre-filled with `hiringName(...)` (the name the page shows), blank when none.
- A blank company stores `employer = null`. For a source that is the employer (paste) the page then shows the source's name as for any such row; for a Gmail/import/folder row it shows "Company not named" (`companyOnPage`). The form says so in its hint.
- If the submitted company equals what the page already shows, it is "unchanged" and `employer` is left alone (so a paste row is not given a redundant `employer`).

## R4 — Location

- **Decision**: `parseLocation(newLocation)` (no hints — the person typed a string), write `location`, `workplace`, `countries`, `regions`, `locationSource` together. Changing the string replaces any earlier structured facets; the classifier's `mergeAiLocation` runs afterwards in the re-score as for any row.
- ADR 0031 says the parser never rewrites `Job.location`; here the **person** rewrites it, which is their data to change.

## R5 — Re-score

- **Decision**: `classifyExistingJob({ ...job, ...updated }, { keepStatus: true, userId })`, skipped when no field changed. Its `Rescored` outcome is worded by a small pure `job-edit-flash.ts`: saved + scored / saved but no search / saved but the engine failed (with reason) / prefiltered / nothing changed.
- `keepStatus: true` satisfies FR-005 and matches `refreshDescription`.
- The existing `onceGuard` pattern wraps the POST so a double press does not spend two calls.

## R6 — UI placement

- **Decision**: "Edit" button in the Details card (right rail) → `GET /jobs/:id/edit` page with a form; on a refused save the page is re-rendered (HTTP 400) with the typed values and a message. A posting that is not editable shows no button; the edit page for it renders a short "shared posting" explanation instead of the form (HTTP 403), per spec story 3.
- **Alternatives**: inline panel in `job-detail.tsx` (already ~900 lines; loses typed text on redirect); `<dialog>` (needs browser JS, contrary to the page's no-JS forms).

## R7 — Not touched

URL, source/company row, salary, status, `postedAt`, fingerprint-based cross-listing link (annotation only, left as ADR 0043 leaves it). Stored comparisons are not deleted; they are not reused because the keyword frame keys on `descriptionRefreshedAt`.
