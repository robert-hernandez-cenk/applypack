# Implementation Plan: Live Status page for a running job

**Branch**: `issue-36-live-status-page` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

## Summary

A per-run page `GET /runs/:id` in the dashboard, plus a "Live Status" link in the
"What happened" cell of RUNNING rows in Run history. While the run is RUNNING the
page shows #32's progress block and refreshes it through `GET /runs/:id/card`
(the existing `public/running.mjs`, pointed at that URL); when the run is over
it shows the same outcome cell as the history row. No schema change.

## Technical Context

**Language/Version**: TypeScript strict, Node 24, Hono JSX (server-rendered)
**Primary Dependencies**: Hono, Prisma (read only), existing `src/i18n`
**Storage**: existing `cron_run` rows (`status`, `stats`, `errorMessage`, `progress`); nothing added
**Testing**: `node --test` for pure helpers and `public/*.mjs`; route smoke for the pages; pseudo-language pass
**Target Platform**: the dashboard (web service only; the worker is untouched)
**Project Type**: web service
**Performance Goals**: one indexed lookup per poll, every 5 s per open page
**Constraints**: members may open it (personal route); no new dependencies; every string in all four catalogs
**Scale/Scope**: 1 new page, 2 routes, 1 link, ~6 catalog keys

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template; the repo's `CLAUDE.md` rules apply instead: named exports, no default exports, pure helpers tested, i18n key per string in every catalog, new route in exactly one policy list, `data-ui="hint"` on helper prose, `npm run css` if a new utility class appears, `exports:audit` clean. No violations planned.

## Project Structure

```text
specs/036-live-status-page/   plan.md research.md data-model.md quickstart.md contracts/routes.md tasks.md
src/web/
├── routes/runs.tsx              # + GET /runs/:id/card, GET /runs/:id (after the fetch-now routes)
├── pages/run-status.tsx         # new: RunStatusPage (running view | final view)
├── pages/run-outcome.tsx        # new: the "What happened" cell, moved out of runs.tsx (StatsCell and its callers)
├── pages/runs.tsx               # uses RunOutcome; adds the Live Status link for RUNNING
├── pages/running-card.tsx       # export RunningBlock
├── run-link.ts                  # new, pure: liveStatusPath(id), parseRunId(param)
└── run-link.test.ts
src/users/admin-policy.ts        # PERSONAL_ROUTES: GET /runs/:id, GET /runs/:id/card
src/i18n/catalog/{en,es,fr,uk}.json
src/scripts/route-smoke.ts       # a running row -> link -> page -> card -> ended -> final view; unknown id
docs/where-to-look.md, CHANGELOG.md
```

**Structure Decision**: follow the Running-now card (ADR 0072): server-rendered fragment, `running.mjs` swaps it, an empty answer means "over" and the page reloads into the final view. No ADR needed (no new decision of weight); the ADR 0072 addendum line is enough if the docs want one.
