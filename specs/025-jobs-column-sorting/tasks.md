---

description: "Task list for sortable columns on the jobs page"
---

# Tasks: Sortable columns on the jobs page

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: requested (TDD, per the repo's testing-gate): the pure module is tested before it is written.

**Worktree**: `C:\Users\rcher\Dev\applypack-Worktrees\issue-25-jobs-column-sorting`. Run npm with `npm --prefix <wt>`.

## Phase 1: Foundational (blocks every story)

**Purpose**: the pure sort module every story reads.

- [x] T001 Write failing tests in `src/web/job-sort.test.ts` for: `parseSort` (the four legacy values map to the same column + direction; `title_desc`, `salary_asc` etc. parse; garbage/empty/undefined → `fetchedAt_desc`), `nextSort` (new column → its default direction: title/company/status asc, fitScore/salary/fetchedAt desc; same column → reversed; `postedAt_desc` current + any column → that column's default), `ariaSort` (sorted column → `ascending`/`descending`, others and `postedAt` → `undefined`), and `sortOrderBy` (see T002)
- [x] T002 Implement `src/web/job-sort.ts` (pure, named exports only): `SORT_VALUES` const tuple (`fetchedAt|fitScore|postedAt|title|company|salary|status` × `asc|desc`), `DEFAULT_SORT = 'fetchedAt_desc'`, `SORTABLE_COLUMNS` with default directions, `parseSort`, `nextSort`, `ariaSort`, and `sortOrderBy(sort): Prisma.UserJobOrderByWithRelationInput[]` — column key then `{ id: 'asc' }` tie-break; `fitScore` → `{ sort, nulls: 'last' }`; `salary` → `job.salaryMin` nulls last; `company` → `job.employer` nulls last then `job.company.name`; `status` → `status`; `title` → `job.title`; `fetchedAt` → `job.fetchedAt`; `postedAt` → `job.postedAt`. Keep the legacy orders' secondary key (`fitScore_desc` then `job.fetchedAt desc`) so SC-004 holds. Use `import type` for Prisma. Make T001 pass.

**Checkpoint**: `npm --prefix <wt> test` green for `job-sort.test.ts`.

## Phase 2: User Story 1 - Sort by clicking a header (Priority: P1)

**Goal**: six headers sort the list; Location does not.

**Independent Test**: on `/jobs`, click Fit → highest first; click again → lowest first; Location is plain text.

- [x] T003 [US1] In `src/web/routes/jobs.tsx` build the `sort` zod enum from `SORT_VALUES` with `.default(DEFAULT_SORT)` (replacing the inline four-value enum), delete the local `sortToOrderBy`, and call `sortOrderBy(sort)` at the `orderBy` site
- [x] T004 [US1] In `src/web/pages/jobs-list.tsx` replace the plain-text Title, Company, Fit, Salary, Status and Fetched entries of `columns` with links `<a href={jobsHref({ ...filters, sort: nextSort(filters.sort, column) })}>` carrying a `title` naming the action; keep the Salary and Fetched `text-right` alignment; leave Location as text. Build the entries from a small local list so the six are not hand-repeated
- [x] T005 [P] [US1] Add the link-title keys to `src/i18n/catalog/en.json`, `es.json`, `fr.json`, `uk.json` (e.g. `jobs.sort.by` — "Sort by {column}" — and `jobs.sort.reverse` — "Reverse the order of {column}"; one message each, params not glued pieces) and run `npm --prefix <wt> test` for `catalog.test.ts`

**Checkpoint**: clicking each header reorders; legacy `?sort=` links unchanged.

## Phase 3: User Story 2 - Sorting keeps context and stays stable (Priority: P1)

**Goal**: filters kept, page 1, no row repeated or skipped between pages.

**Independent Test**: filter + page 2 + click a header → same filters, page 1.

- [x] T006 [US2] Add tests in `src/web/job-sort.test.ts` asserting every `sortOrderBy` result ends with the `{ id: 'asc' }` tie-break and that `jobsHref({ ...filters, sort: nextSort(...) })` keeps filters and drops `page` (compose with `jobsHref` from `src/web/job-facets.ts`)
- [x] T007 [US2] Confirm in the browser (T013) that a header click from page 2 with a status tab and a place filter lands on page 1 with the filters intact; fix `jobs-list.tsx` if any filter is dropped

**Checkpoint**: SC-002 and SC-003 hold.

## Phase 4: User Story 3 - Sort state visible and announced (Priority: P2)

**Goal**: arrow + `aria-sort` on the sorted header.

**Independent Test**: sort by Salary → arrow on Salary, `aria-sort` on that `th` only.

- [x] T008 [US3] In `src/web/ui.tsx` add an optional `ariaSort?: ('ascending' | 'descending' | undefined)[]` prop to `Table`, set `aria-sort` on the matching `th`
- [x] T009 [US3] In `src/web/pages/jobs-list.tsx` pass `ariaSort={columns.map(c => ariaSort(filters.sort, c))}` and render an `aria-hidden` arrow (↑ / ↓) inside the active header link; confirm the dropdown shows its option as selected only when the sort matches one (`postedAt_desc` highlights no header)
- [x] T010 [US3] Check the header links against `accessible-interactions` (keyboard focus ring visible, Enter activates, contrast of the arrow); add any new tailwind classes and run `npm --prefix <wt> run css`, committing `src/web/public/tailwind.css` if it changed

**Checkpoint**: SC-005 holds.

## Phase 5: Polish & verification

- [x] T011 [P] Add a row for "/jobs column sorting (sort values, next link, orderBy)" to `docs/where-to-look.md` pointing at `src/web/job-sort.ts`, and mention it in the existing `/jobs` facets row if that row lists the sort
- [x] T012 Run `npm --prefix <wt> run lint:types`, `npm --prefix <wt> test` and `npm --prefix <wt> run exports:audit`; paste real output
- [x] T013 Browser check per [quickstart.md](./quickstart.md) on a scratch data folder (`APPLYPACK_DATA_DIR`, never the live one) at 1280 px and 390 px, including all four languages for the link titles; note anything not verified
- [x] T014 Mark every box above complete in this file in the same commit as the verification

## Dependencies

- T001 → T002 → everything else.
- US1 (T003–T005) before US2 (T006–T007) and US3 (T008–T010); US2 and US3 are independent of each other.
- T011 can run any time after T002; T012–T014 last.

## Implementation strategy

MVP = Phase 1 + US1 (headers sort). Then US2 checks, then US3 indicators. Commit per phase with `(#25, USn)` suffixes.
