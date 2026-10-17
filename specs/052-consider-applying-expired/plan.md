# Implementation Plan: Consider, Applying and Expired stages; a collapsible No Offer column

**Branch**: `issue-52-consider-applying-expired` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/052-consider-applying-expired/spec.md`

## Summary

Three new fixed stages (Consider, Applying before Applied; Expired after Ghosted) and a visible last board column,
**No Offer**, that groups the three end states. Stages are strings in `UserJob.pipelineStage`, so the schema does
not change. The risk is the readers that treat "has any stage" as "has applied": one pure rule (`hasApplied`) now
decides, and each reader is routed through it. The No Offer collapse is a per-viewer convenience in a small
dependency-free browser module.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: Hono JSX (server-rendered), Prisma 6, zod; browser ES modules in `src/web/public/`, no build step

**Storage**: PostgreSQL 16 — no migration (stage is a free string; `expired` etc. are new values only)

**Testing**: `node:test` via `npm test` (pure modules only); route smoke (`npm run smoke:routes`) for routes and pages

**Target Platform**: server-rendered dashboard, desktop + mobile browsers

**Project Type**: web application (single package)

**Performance Goals**: none beyond the existing board (one query per page)

**Constraints**: four interface languages + the pseudo-language pass; `exports:audit` forbids dead or over-exported exports

**Scale/Scope**: ~12 source files, 4 catalogs, 1 ADR

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so there are no project gates from it. The binding
rules are the repo's `CLAUDE.md` and skills: named exports only, pure modules tested, zod at boundaries, no magic
numbers, catalog keys in all four languages, `accessible-interactions` for the toggle, `adr-writer` for the ADR,
`testing-gate` and `commit-discipline`. Re-checked after design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/052-consider-applying-expired/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/routes.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── applied-state.ts            # NEW pure: PRE_APPLY_KEYS, hasApplied, appliedWhere (Prisma where fragment)
├── web/
│   ├── stage-config.ts         # fixed stages, END_STAGES, reserved keys, nextStageKey
│   ├── stage-time.ts           # no "applied Nd ago" for Consider/Applying
│   ├── applied-resume.ts       # needsAppliedResume via hasApplied
│   ├── routes/applications.tsx # POST /jobs/:id/consider; quick-move sets appliedAt on Applied; No Offer grouping
│   ├── routes/jobs.tsx         # Mark applied advances Consider/Applying/none to Applied
│   ├── routes/companies.tsx, routes/jobs-import.tsx  # application counts via appliedWhere
│   ├── pages/applications.tsx  # No Offer column, badges, Unfiled panel, collapse toggle
│   ├── pages/job-detail.tsx    # Consider button
│   └── public/
│       ├── board.mjs           # planMove with a drop group; open a collapsed rail while dragging
│       └── column-collapse.mjs # NEW pure helpers + initCollapse(doc)
├── pack/store.ts               # appliedTo / packJobState via the shared rule
├── i18n/catalog/{en,es,fr,uk}.json (+ i18n-en.mjs via `npm run i18n:browser`)
└── scripts/route-smoke.ts      # Consider -> Applying -> Applied, No Offer with each end state
docs/adr/0080-consider-applying-expired-no-offer.md   # amends 0025
docs/where-to-look.md, CHANGELOG.md, package.json(+lock) -> 2.59.15
```

**Structure Decision**: keep the existing layout; one new pure module (`src/applied-state.ts`) and one new browser
module beside `board.mjs`.

## Complexity Tracking

None.
