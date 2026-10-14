# Research: Jobs by source panel

## Where a match's source lives

- **Decision**: read `job.company.atsType` on the rows the stack card already loads.
- **Rationale**: every `Job` belongs to a `Company` row; aggregators are one synthetic row each, vendors one per board, and the user's own sources (`GMAIL`, `FOLDER`, `IMPORT`, `MANUAL`, `FEED`, …) their own hidden or visible rows. `atsType` is therefore the "kind of source" the issue asks for, with no schema change.
- **Alternatives**: `Job.sourceFile` / `Company.name` (too fine: one entry per board or file, not "company boards"); a new `Job.source` column (schema change for data we already have).

## What the "Company boards" merge is

- **Decision**: `sourceFamily(atsType) === 'vendor'` (`src/web/source-groups.ts`) → one entry.
- **Rationale**: that function is already the repo's definition of "per-company vendor boards" (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Breezy, BambooHR, Pinpoint, Rippling, Personio, Teamtailor). A new vendor added there is merged automatically.
- **Alternatives**: a hand-kept list in the new code (drifts); showing every vendor (the issue's own example asks for "company board" as one thing).

## Names

- **Decision**: word each entry with `source-names.ts:sourceLabel`; add one catalog key for "Company boards". Mark the label `translate="no"` only when `wordedSource` is false.
- **Rationale**: `sourceLabel` already returns vendor/aggregator names as written and the catalog's words for Feed / Careers page / Folder / Import / Gmail / Manual. Reuse keeps the Overview consistent with Settings and Discovery.
- **Alternatives**: a second label map (duplication).

## Counting

- **Decision**: count every match in the 30-day window, whether or not it names a technology.
- **Rationale**: the stack card counts technology mentions (a job counts once per tag, jobs with none are absent); the source card counts postings, so its entries sum to the footer's total. The two cards therefore differ in what a bar means, which the info text states.
- **Alternatives**: counting only rows with `techMatch` (would silently drop sources whose postings the classifier tagged nothing for).

## `/runs` "By source, last 30 days"

Different thing: it lists what each source *fetched* per tick (`bySource` in the run stats), not which stored matches came from where. Left alone; the Overview card answers "where do my matches come from".

## Clicking a bar

Out of scope: the chart reads `funnel_day`, which has no source dimension, and the jobs list has no source filter. Bars are plain rows.
