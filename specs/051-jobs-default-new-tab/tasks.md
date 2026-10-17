---

description: "Tasks for the jobs list opening on New (#51)"
---

# Tasks: Jobs list opens on New

**Input**: `specs/051-jobs-default-new-tab/` (spec.md, plan.md, research.md, data-model.md, contracts/jobs-status.md)

**Tests**: pure resolver unit tests (TDD) and the route smoke.

## Phase 1: Setup

- [x] T001 Baseline: `npm --prefix <wt> run lint:types` and `npm --prefix <wt> test` pass before any change

## Phase 2: User Story 1 + 2 — New by default, All on purpose (P1)

- [x] T002 [US1] Write failing tests in `src/web/job-facets.test.ts` for `resolveJobsStatus`: undefined → NEW, '' → NEW, 'all' → 'all', each of the five statuses → itself, 'new' / 'bogus' → null; and `jobsHref` / `clearFiltersHref` keep `status=all` and `status=NEW`
- [x] T003 [US1] Add `resolveJobsStatus` (+ constants for default and all) to `src/web/job-facets.ts`; tests from T002 pass
- [x] T004 [US1] `src/web/routes/jobs.tsx`: `ListQuerySchema.status` uses the resolver (invalid → 400 as today); add the status predicate and the single-status total only for a real status; pass the resolved value as `filters.status`
- [x] T005 [US1] `src/web/pages/jobs-list.tsx`: tab order New, Alerted, Applied, Saved, Dismissed, All with All = `'all'`; current-tab check, hidden `status` input and counts follow the resolved value; empty-state rule from research.md (`hasFilters` status part)
- [x] T006 [US2] `src/scripts/route-smoke.ts`: bare `/jobs` lists New only and has New current; `/jobs?status=all` lists every status with All current and All's links keep it; `?status=bogus` is 400; update the existing assertions that assumed bare `/jobs` lists everything (isolation check around line 1519, menu check)

## Phase 3: User Story 3 — links that meant everything (P2)

- [x] T007 [US3] Add `status=all` to the "everything" links per research.md: `overview.tsx` (empty-alerts "See all jobs", `watched=1`), `job-detail.tsx` (back link, `profile=`, `country=`), `job-new.tsx`, `job-import.tsx`, `target.tsx` breadcrumb, `muted-companies.tsx` (`muted=1`); grep for any bare `/jobs` link left and decide each

## Phase 4: Docs and release

- [x] T008 Update the `/jobs` list row(s) in `docs/where-to-look.md`; SPEC.md / README mentions of the default tab if any
- [x] T009 Patch release bump: next `vX.Y.(Z+1)` in `package.json`, `package-lock.json`, top `CHANGELOG.md` entry (tag after merge, not here)

## Phase 5: Verify

- [x] T010 `npm run lint:types`, `npm test`, `npm run exports:audit`; route smoke on a throwaway Postgres; rebuilt dashboard checked by eye at desktop and phone width (quickstart.md step 4)

## Dependencies

T002 → T003 → T004 → T005 → T006; T007 after T003; T008–T009 any time after T005; T010 last.
