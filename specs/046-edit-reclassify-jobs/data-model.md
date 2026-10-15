# Data Model: Edit a job's details

No schema change, no migration.

## Columns written by an edit (all on `Job`)

| Field edited | Columns written | Rule |
|--------------|-----------------|------|
| Title | `title` | trimmed, 1–300 chars |
| Company | `employer`, `employerKey` | ≤ 200 chars; blank → `employer = null`; key = `hiringKey(employer, company.name, !sourceIsEmployer(atsType))` |
| Location | `location`, `workplace`, `countries`, `regions`, `locationSource` | ≤ 300 chars, may be empty; facets from `parseLocation(location)` |
| Description | `description`, `descriptionOriginal`, `descriptionRefreshedAt`, `descriptionSimhash` | normalised; 200–60 000 chars when changed; `descriptionOriginal` keeps the first original (`job.descriptionOriginal ?? job.description`) |

Only the columns of fields that actually changed are written.

## Never written by an edit

`url`, `companyId`, `externalId`, `salary*`, `postedAt`, `sourcePayload`, `liveness*`, `crossListedOfJobId`, and every `UserJob` field except what the re-score itself writes through `saveJobScores` (fit, verdict, summary — never `status`, because `keepStatus: true`).

## Holder rule

`holders(jobId) = UserJob rows with jobId`. Editable by `userId` iff `holders.length === 1 && holders[0].userId === userId`.

## State transitions

- Description: `descriptionOriginal` null → first original set on the first edit; later edits keep it; "Restore the original" (existing) swaps it back and nulls it.

## Editable sources (added after review)

`editable = atsType ∈ {MANUAL, GMAIL, IMPORT, FOLDER} && holders.length === 1 && holders[0].userId === userId`.
