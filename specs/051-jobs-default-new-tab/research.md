# Research: Jobs list opens on New

## Where the resolver lives
- **Decision**: pure `resolveJobsStatus(raw: string | undefined)` in `src/web/job-facets.ts`, returning `JobStatus | 'all' | null` (null = invalid, the route answers 400).
- **Rationale**: `routes/jobs.tsx` imports Prisma and is not unit-tested (CLAUDE.md); `job-facets.ts` is pure and already tested. The route still resolves in one place by calling it from `ListQuerySchema`.
- **Alternatives**: inline in the zod schema (untestable without Prisma); a new module (too small to justify).

## How the URL carries the tab
- **Decision**: `JobsFilters.status` always holds the resolved value (`NEW`…`DISMISSED` or `all`); `jobsHref` is unchanged, so every link writes `status=NEW` explicitly. Bare `/jobs` is only ever an entry URL.
- **Rationale**: current-tab check, filter links, sort/pagination links and clear-filters stay consistent with no special case. Keeping `status=NEW` explicit avoids a link built for All being mistaken for the default.
- **Alternatives**: omit the default from URLs (shorter, but every link builder then needs the default rule).

## Empty state
- Previously any status tab counted as "a filter", so an empty tab showed "no jobs match". With New as the default that would hide "no jobs yet" for a fresh install. **Decision**: the status counts as a narrowing filter unless it is `all`, or it is `NEW` while the person has no postings at all (sum of tab counts is 0).
- Caveat: counts are taken under the other filters; with a search/filter active `hasFilters` is already true, so this only decides the unfiltered case.

## Link audit
- To `status=all`: `overview.tsx` "See all jobs" empty-state button; `job-detail.tsx` back link, `?profile=` and `?country=` links; `job-new.tsx` / `job-import.tsx` back links (label "All jobs"); `target.tsx` breadcrumb; `muted-companies.tsx` `?muted=1`; `overview.tsx` `?watched=1`.
- Untouched: `?status=<STATUS>` links (Overview cards, recent alerts), the menu link, "Open your jobs" buttons, `jobs-list.tsx` bare `/jobs` in empty states (lands on New by design), route-smoke redirect `back` values that name a status.

## After code review
- `watchlist.tsx` (`/jobs?q=<company>`) was missed by the first audit; it now carries `status=all`, like the other search-by-thing links.
- The empty state's "Clear all filters" button went to bare `/jobs`, which is the New view it was already on; it now goes to `status=all`.
- Left on the default on purpose: the post-import redirect (imported rows are New), the run-gone redirect and the target run's back link, `applications.tsx` / `resume-detail.tsx` "Open your jobs", and the menu.
- `resolveJobsStatus` returns `JobStatus | 'all' | null`, built on a record keyed by the Prisma enum, so a new status fails to compile until listed.
