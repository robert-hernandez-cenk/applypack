# Implementation Plan: Tailored resume copies

**Branch**: `issue-48-tailored-resume-copies` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/048-tailored-resume-copies/spec.md` (GitHub issue #48)

## Summary

The target page's save stops overwriting the `Resume` row. It writes a `TailoredResume` — one per (resume, posting), upserted — using the same patch / clean-`.docx` path as today. The post-save comparison judges the copy's text and is stored against the master with a new nullable `ResumeMatch.tailoredId`, which the master's count, best score and coverage queries filter out. A copy is a separate table, so scans, the resumes list, other-resume hints and the duplicate check never see it. The page, the resume page, a download route, a delete route and a confirmed "Promote to master" (the old overwrite, via `replaceResumeFile`) complete it.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: Hono (server JSX), Prisma 6, zod, pino — nothing added

**Storage**: Postgres 16; one hand-written migration (table `tailored_resume`, column `resume_match.tailoredId` + FK + index)

**Testing**: `node --test` through tsx on pure modules; `npm run lint:types`; `npm run exports:audit`; i18n `catalog.test.ts`; `prisma migrate diff`; route smoke (`npm run smoke:routes`, throwaway DB only)

**Target Platform**: the dashboard (`src/web/`) and the shared store code; local launcher and Docker alike

**Project Type**: web service + cron worker

**Performance Goals**: none; the save is as slow as today's (one patch + one comparison), minus the master's re-scan

**Constraints**: CLAUDE.md rules — `userId` first in every store function (ADR 0068); a route sits in exactly one of `ADMIN_ROUTES` / `PERSONAL_ROUTES`; a catalog key ships in all four languages; `exports:audit` fails on dead exports; `tailwind.css` regenerated if a new utility class appears; patch release only (fork rule) with a CHANGELOG entry; example values only in docs

**Scale/Scope**: ~12 source files, 4 catalogs, 4 docs, 1 migration, 1 ADR

## Constitution Check

- Example values only in docs/specs: satisfied.
- Pure logic is pure and tested: the patch-base choice and the copy's file name (`resume/tailored.ts`) are pure and unit-tested; Prisma stays in `resume/store.ts`.
- Dead code is a CI failure: nothing is left unused.
- ADR required (schema + a rule others depend on): ADR 0077.

No violations. Re-checked after design: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/048-tailored-resume-copies/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/routes.md
└── tasks.md
```

### Source Code (touched)

```text
prisma/
├── schema.prisma                         # TailoredResume; ResumeMatch.tailoredId; back-relations
└── migrations/20261016120000_tailored_resume/migration.sql
src/resume/
├── tailored.ts (+ test)                  # pure: patch-base choice, copy file name
├── store.ts                              # upsert/get/list/delete/promote copy; createMatch tailoredId;
│                                         #   matchStatsByResume + listLatestKeywordTables filter tailoredId
└── match.ts                              # opts.tailoredId passed to createMatch
src/web/
├── routes/resumes.tsx                    # saveEdited -> saveTailored; draft route needs jobId;
│                                         #   /tailored/:id/download|delete|promote; resume page loads copies
├── routes/jobs.tsx                       # target page loads the job's copy
├── pages/target.tsx                      # "Save tailored copy"; copy line + download
├── pages/resume-detail.tsx               # "Tailored copies" card
└── public/target-page.mjs                # save-button wording if it carries the version
src/users/admin-policy.ts                 # 3 routes -> PERSONAL_ROUTES
src/i18n/catalog/{en,es,fr,uk}.json       # target.save.*, resume.save.*, resume.tailored.*
src/scripts/route-smoke.ts                # save a copy; download; promote; delete
docs/where-to-look.md, docs/adr/0077-*.md, ARCHITECTURE.md, CLAUDE.md, CHANGELOG.md, package.json (2.59.11)
```

**Structure Decision**: copies are their own table and their own store functions, never a flag on `Resume`, so every existing resume query excludes them without being touched. Only `ResumeMatch` is shared and needs an explicit filter.

## Complexity Tracking

No constitution violations to justify.
