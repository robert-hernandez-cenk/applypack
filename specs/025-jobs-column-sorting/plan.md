# Implementation Plan: Sortable columns on the jobs page

**Branch**: `issue-25-jobs-column-sorting` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

## Summary

Make six column headers of the `/jobs` table sort links. The sort is server-side: the `sort` query value widens from four fixed strings to `<column>_<asc|desc>`, and a new pure module turns it into a Prisma `orderBy` and into the next link a header points at. No schema change.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (>=22)
**Primary Dependencies**: Hono (server JSX), Prisma 6, zod — nothing new
**Storage**: Postgres; read-only change (a different `orderBy` on `user_job`)
**Testing**: `node --test` over `src/**/*.test.ts` (`npm test`), `npm run lint:types`; the pure module is unit-tested, the route/page are covered by the route smoke and a browser check
**Target Platform**: the dashboard (web service), desktop and phone widths
**Project Type**: web dashboard (separate from the cron worker)
**Performance Goals**: no new query; ordering uses columns already read. Sorts on `job.company.name` / `job.employer` add a join the planner already makes for the select
**Constraints**: CLAUDE.md — pure helpers in their own file, named exports, no magic numbers, every visible string a key in all four catalogs, tailwind utilities regenerated with `npm run css` if a new class is used
**Scale/Scope**: ~1k rows per person today; one page of 50 per request

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so there are no gates from it. The repo's `CLAUDE.md` rules apply and the plan honours them: pure module + test, i18n in all catalogs in the same PR, `where-to-look.md` row updated, accessible-interactions skill for header controls (links, `aria-sort`, visible focus).

## Project Structure

### Documentation (this feature)

```text
specs/025-jobs-column-sorting/
├── plan.md
├── research.md
├── quickstart.md
└── tasks.md   # next stage
```

### Source Code

```text
src/web/job-sort.ts            # NEW, pure: columns, parse, next, aria, orderBy
src/web/job-sort.test.ts       # NEW
src/web/routes/jobs.tsx        # sort enum from job-sort.ts; sortToOrderBy removed
src/web/pages/jobs-list.tsx    # header cells -> sort links
src/web/ui.tsx                 # Table: optional per-column ariaSort
src/i18n/catalog/{en,es,fr,uk}.json   # sort-link title words
docs/where-to-look.md          # /jobs sort row
```

**Structure Decision**: single pure module beside `job-facets.ts` (which owns the other /jobs query params and `jobsHref`). `job-sort.ts` does not import `job-facets.ts`; the page composes them.

## Design

- **Values**: columns `fetchedAt|fitScore|postedAt|title|company|salary|status` × `asc|desc`, as a const tuple the route's zod enum is built from. `fetchedAt_desc`, `fitScore_desc`, `postedAt_desc`, `title_asc` stay members, so old links are unchanged. `DEFAULT_SORT = 'fetchedAt_desc'`.
- **Columns**: six sortable columns (title, company, fitScore, salary, status, fetchedAt), each with a `defaultDir` (asc: title, company, status; desc: fitScore, salary, fetchedAt). `postedAt` is a valid sort but not a column.
- **`parseSort(value)`** → `{ column, dir }`, falling back to the default.
- **`nextSort(current, column)`** → the value a header's link carries: reverse if `column` is the current one, else the column's default direction.
- **`ariaSort(current, column)`** → `'ascending' | 'descending' | undefined`.
- **`sortOrderBy(sort)`** → `Prisma.UserJobOrderByWithRelationInput[]`: the column key, then `{ id: 'asc' }` tie-break. Nulls last for fitScore, salary (`job.salaryMin`) and company (`job.employer`, then `job.company.name`). Status orders by the enum's declared order (see research).
- **Page**: `Table` gets `ariaSort?: (… | undefined)[]`; `jobs-list.tsx` builds the `columns` entries as `<a href={jobsHref({ ...filters, sort: nextSort(...) })}>` with an `aria-hidden` arrow when active. `jobsHref` already drops the page and keeps filters. Right-aligned columns keep their alignment.
- **Dropdown**: unchanged options; the selected option is the one matching the current sort, none otherwise.

## Complexity Tracking

None.
