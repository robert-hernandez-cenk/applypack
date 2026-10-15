# Implementation Plan: Edit a job's details and re-classify it

**Branch**: `issue-46-edit-reclassify-jobs` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/046-edit-reclassify-jobs/spec.md` (issue #46)

## Summary

A person who is the only holder of a posting (Gmail, pasted, imported, folder) edits its title, company, location and description on a new page, `/jobs/:id/edit`, reached from the Details card. A save writes the changed columns, refills the place facets and the employer key, keeps the description it arrived with (the ADR 0043 columns), and re-scores the posting with `keepStatus: true`. A posting that other people hold is refused. No schema change.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: Hono + `hono/jsx` (dashboard), Prisma 6, zod; no new packages

**Storage**: Postgres 16 — existing `Job` columns only (`title`, `employer`, `employerKey`, `location`, `workplace`, `countries`, `regions`, `locationSource`, `description`, `descriptionOriginal`, `descriptionRefreshedAt`, `descriptionSimhash`); no migration

**Testing**: `node --test` on pure modules (`job-edit.test.ts`), the i18n catalog test, the route smoke (`smoke:routes`) for the GET page and a POST

**Target Platform**: the web dashboard process only; the worker never imports the new files

**Project Type**: web service (dashboard in `src/web/`, logic in `src/jobs/`)

**Performance Goals**: none beyond one classifier call per save (the existing Re-classify cost)

**Constraints**: personal route (not admin); every string a catalog key in en/uk/es/fr; patch version bump only (2.59.8 → 2.59.9); no `Co-Authored-By`

**Scale/Scope**: one page, one POST, one pure module, one store function

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template; the gates are the project `CLAUDE.md` rules.

| Rule | Status |
|------|--------|
| Pure logic in a tested pure module; DB in a store | PASS — `job-edit.ts` pure, `job-edit-store.ts` writes |
| No default exports, zod/typed errors, no `console.log` | PASS |
| i18n: keys in all four catalogs, `translate="no"` on posting data | PASS (planned) |
| New route in exactly one of `ADMIN_ROUTES` / `PERSONAL_ROUTES` | PASS — personal |
| Employer rules: `employerKey` written with the row; "not named" never borrows the source (ADR 0056, #444) | PASS — see research R3 |
| Location rules: `parseLocation` fills facets; `Job.location` is the user's own string here (ADR 0031) | PASS — see R4 |
| Description change keeps original, dates the swap, fingerprint follows (ADR 0043/0018) | PASS — reuses the same columns (R2) |
| AI calls only through `classifyExistingJob` | PASS |
| `exports:audit` — no dead export | PASS if every export is used (checked at verify) |

Post-design re-check: same result.

## Project Structure

### Documentation (this feature)

```text
specs/046-edit-reclassify-jobs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/routes.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/jobs/job-edit.ts              # new, pure: sole-holder rule, form → planned changes | error code
src/jobs/job-edit.test.ts         # new
src/jobs/job-edit-store.ts        # new: re-checks holders, one update, then classifyExistingJob(keepStatus)
src/jobs/description-refresh.ts   # export descriptionColumns() so the swap and the edit share one definition
src/web/pages/job-edit.tsx        # new: the form page (values kept on a refused save)
src/web/routes/jobs.tsx           # GET/POST /jobs/:id/edit
src/web/pages/job-detail.tsx      # "Edit" button on the Details card when editable
src/web/job-edit-flash.ts         # new, pure: Rescored + changes → flash key (like rescore-flash.ts)
src/users/admin-policy.ts         # two PERSONAL_ROUTES entries
src/i18n/catalog/{en,uk,es,fr}.json
docs/where-to-look.md, SPEC.md, ARCHITECTURE.md   # rows for the edit
package.json, package-lock.json   # 2.59.9
```

**Structure Decision**: the repo's existing split — pure rules and flash words in their own files, one store file that touches Prisma, routes and JSX in `src/web/`. The edit is a page of its own, not a panel inside the 700-line job page, so a refused save can re-render with what was typed.

## Complexity Tracking

None.
