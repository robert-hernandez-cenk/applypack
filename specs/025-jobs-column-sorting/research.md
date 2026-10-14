# Research: Sortable columns on the jobs page

## Status order

- **Decision**: Status sorts by the database enum order (NEW, ALERTED, APPLIED, DISMISSED, SAVED).
- **Rationale**: Prisma orders an enum column by its declared order; there is no cheap way to apply the tab order (NEW, ALERTED, APPLIED, SAVED, DISMISSED) without raw SQL. The difference is only where SAVED and DISMISSED fall.
- **Alternatives**: raw SQL `CASE` ordering (rejected: breaks the Prisma query shape for one swap); reorder the enum (rejected: schema migration, out of scope). FR-010 is amended to "in the order the statuses are declared".

## Company key

- **Decision**: order by `job.employer` (nulls last), then `job.company.name`.
- **Rationale**: the column shows `companyOnPage(employer, company).name`: the employer for aggregator rows, the company's name otherwise. Per-company rows have a null `employer`, so they would all sort last by employer alone; the second key places them by company name. Aggregator rows that name nobody show "Company not named" and are ordered by their source's name — an accepted approximation.
- **Alternatives**: a derived sort column (schema change, rejected); in-memory sort of a page (rejected: wrong across pages).
- **Note**: a posting with both keys null cannot occur; `company.name` is required.

## Fit with a search selected

The Fit cell shows the selected search's score, while `UserJob.fitScore` is the best-of. Prisma cannot order by a filtered relation, so the sort stays on the best-of — the behaviour the "Highest fit" menu entry already has. Recorded in the spec's edge cases; aligning is a follow-up.

## Header control

Links, not buttons: sorting is a navigation (GET), works without script, and keeps filters through `jobsHref`. `aria-sort` goes on the `th`. The arrow is `aria-hidden`; the sort state is spoken through `aria-sort`, and each link has a `title` naming the action.

## Salary compares the numbers as posted

- **Decision**: Salary sorts by the stored lower bound (`salaryMin`) as posted; currency and period are not converted.
- **Rationale**: a posting's own currency and period are stored beside the number (`salaryCurrency`, `salaryPeriod`), and the conversion lives in `src/currency.ts` in application code. A database ordering over converted values needs raw SQL or a stored, converted column, and the spec rules out schema changes. Most postings are annual, where the order is right.
- **Known limit**: an hourly or monthly figure, or one in another currency, sits where its raw number falls, not where its yearly USD value would. Recorded as a follow-up (a stored yearly-USD column would fix it for this sort and any filter).
