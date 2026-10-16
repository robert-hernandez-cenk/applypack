# Implementation Plan: One tailoring front door

**Branch**: `issue-55-one-tailoring-front-door` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/055-one-tailoring-front-door/spec.md` (GitHub issue #55)

## Summary

Remove the `/target` launcher and everything that exists only for it — the hidden scratch `Resume` row, the `ephemeral` editor mode, the one-off re-run logic, the "own resume" tick-box and the text-evidence writer — so the job's Resume match tab is the only way to start a comparison. The match form gains the page-length select (ADR 0074). `/letter` is cut to a stored job and a saved resume. A migration deletes hidden resumes (their matches, reviews and letters cascade) and drops the `hidden` column.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: Hono (server JSX), Prisma 6, zod, pino — nothing added

**Storage**: Postgres 16; one hand-written migration (delete hidden `Resume` rows, drop `Resume.hidden`)

**Testing**: `node --test` through tsx on pure modules (`npm test`); `npm run lint:types`; `npm run exports:audit`; `npm run css` parity; route smoke (`npm run smoke:routes` on a throwaway DB); `prisma migrate diff`

**Target Platform**: the dashboard (`src/web/`), local launcher and Docker alike

**Project Type**: web service + cron worker (dashboard is a separate Hono service)

**Performance Goals**: none — a removal

**Constraints**: CLAUDE.md rules — a catalog key ships in every language (`catalog.test.ts`); `exports:audit` fails on dead exports; a route lives in exactly one of `ADMIN_ROUTES` / `PERSONAL_ROUTES`; `tailwind.css` is generated and committed; patch release only (fork rule) with a CHANGELOG entry

**Scale/Scope**: ~25 source files touched, 4 catalogs, 3 docs, 1 migration, 1 new ADR

## Constitution Check

`.specify/memory/constitution.md` is the repo's own; the gates that apply:

- Example values only in docs/specs (no real hosts, IPs, credentials): satisfied — nothing new of that kind.
- Pure modules stay pure and tested: `match-name.ts` shrinks but stays pure; its tests are rewritten, not dropped.
- Dead code is a CI failure (`exports:audit`): the plan removes whole modules rather than leaving unused exports.

No violations. Re-checked after design: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/055-one-tailoring-front-door/
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
├── schema.prisma                  # Resume.hidden removed
└── migrations/20261016090000_remove_scratch_resume/migration.sql

src/web/
├── routes/target.tsx              # GET/POST /target removed; progress routes stay
├── routes/jobs.tsx                # /jobs/:id/match, reupload, GET target: no hidden/oneOff
├── routes/letter.tsx              # stored job + saved resume only
├── routes/resumes.tsx, resume-render.tsx, settings.tsx, welcome.tsx   # `hidden` refusals gone
├── resume-source.ts               # keeps listResumeOptions/ResumeOption only
├── layout.tsx                     # nav entry 'target' removed
├── pages/target-start.tsx         # deleted (ModeCard moves to ui)
├── pages/letter-start.tsx         # job + resume pickers only
├── pages/resume-match-card.tsx    # page-length select; no /target links
├── pages/target.tsx               # `ephemeral` removed
├── public/target-start.mjs, target-start.test.ts   # deleted
└── target-runs.ts                 # backUrl default no longer '/target'
src/resume/
├── store.ts                       # upsertScratchResume + hidden filters removed
├── match-name.ts (+ test)         # hidden branches removed
└── cover-letter.ts                # evidence always 'own' unless a caller overrides
src/users/admin-policy.ts          # 'GET /target', 'POST /target' removed
src/i18n/catalog/{en,es,fr,uk}.json
docs/where-to-look.md, docs/adr/0074-*.md (addendum), docs/adr/0076-*.md (new), CHANGELOG.md, package.json (patch)
```

**Structure Decision**: delete rather than deprecate. Shared pieces that outlive the launcher (`ModeCard`, `JobPicker`, `listResumeOptions`) move or stay where `/letter` and `/screen/new` can import them.

## Complexity Tracking

No constitution violations to justify.
