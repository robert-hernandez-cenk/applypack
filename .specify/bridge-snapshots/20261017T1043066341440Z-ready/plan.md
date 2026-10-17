# Implementation Plan: Jobs list opens on New

**Branch**: `issue-51-jobs-default-new-tab` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/051-jobs-default-new-tab/spec.md`

## Summary

`/jobs` resolves its `status` query once: missing or empty becomes `NEW`, `all` means no filter, one of the five statuses is itself, anything else is the existing 400. The resolver is a pure function in `src/web/job-facets.ts`; `routes/jobs.tsx` calls it and hands the result to the page, whose tab strip is reordered with All last (value `all`). Links that meant "everything" gain `status=all`. No schema, setting or migration change.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: Hono + JSX server pages, zod, Prisma (read-only here)

**Storage**: N/A (no change)

**Testing**: `node --test` on pure modules (`job-facets.test.ts`); route smoke (`npm run smoke:routes`) on a throwaway Postgres

**Target Platform**: the local dashboard / Docker server

**Project Type**: web-service (server-rendered dashboard)

**Performance Goals**: unchanged (same queries; the default now adds a `status = NEW` predicate)

**Constraints**: all UI text through the i18n catalog (no new English outside it); patch release only

**Scale/Scope**: one route, one page, ~8 link sites, one doc row

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so there are no project gates. The repo's CLAUDE.md rules apply: pure logic is unit-tested; named exports only; zod for external input (the query already goes through `ListQuerySchema`).

## Project Structure

### Documentation (this feature)

```text
specs/051-jobs-default-new-tab/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/jobs-status.md
└── tasks.md
```

### Source Code

```text
src/web/job-facets.ts            # resolveJobsStatus (+ JOBS_ALL_STATUS, JOBS_DEFAULT_STATUS); jobsHref unchanged
src/web/job-facets.test.ts       # resolver cases, hrefs keep NEW/all
src/web/routes/jobs.tsx          # ListQuerySchema.status -> resolver; where-clause only when a real status; filters.status
src/web/pages/jobs-list.tsx      # STATUS_TABS order, All = 'all', hasFilters / empty-state rule
src/web/pages/{overview,job-detail,job-new,job-import,target}.tsx   # status=all on "everything" links
src/scripts/route-smoke.ts       # bare /jobs shows New, status=all shows all, 400 on junk
docs/where-to-look.md            # list row
package.json, package-lock.json, CHANGELOG.md   # patch bump
```

**Structure Decision**: keep the resolver beside `jobsHref`/`JobsFilters`, which already own the page's query vocabulary.

## Complexity Tracking

None.
