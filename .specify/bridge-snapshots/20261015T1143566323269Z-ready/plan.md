# Implementation Plan: Page target for resume tailoring

**Branch**: `issue-38-resume-length-control` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/038-resume-length-control/spec.md`

## Summary

Add a Length choice (Keep as is / 1 / 2 / 3 pages) to the Tailor launcher. The target is stored in the comparison's `breakdown` marker (like `mode` and `evidence`), is part of the reuse memo key, and when set adds a LENGTH TARGET block to the user message of the two prompts that write removals (full match and suggestions). The block states the overshoot, orders cuts by least relevance to the posting and raises the removals cap. Cuts still pass `gateRemovals` and are applied by the person. The editor shows a live approximate page meter from a browser mirror of a new pure `length.ts`. Details and the two seams that differ from the first sketch (no `PROMPT_VERSION` bump; block in both prompts) are in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines ≥ 22); browser code is dependency-free ES modules
**Primary Dependencies**: existing only (Hono JSX, zod, Prisma — no schema change)
**Storage**: none new; one more key in the `ResumeMatch.breakdown` JSON
**Testing**: Node built-in runner; pure modules unit-tested; mirror parity test; prompt snapshot test; i18n catalog test; route smoke in CI
**Target Platform**: the dashboard (web service) only; the worker's pack is untouched
**Project Type**: web application (dashboard + cron worker)
**Performance Goals**: meter updates synchronously on edit (< 1 s, SC-005); no extra AI calls
**Constraints**: `keep` prompts byte-identical (FR-008); no `PROMPT_VERSION` bump; safety stays in code (CLAUDE.md gotcha 11); estimate labelled approximate
**Scale/Scope**: 1 new pure module + mirror, 6–8 edited files, 1 ADR, docs rows

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so it sets no gates. The project's own rules in `CLAUDE.md` are the gates and are met: the pure module has no I/O; the browser mirror has a parity test; all new strings go through `t()` with every catalog updated; the removal limits are code (`gateRemovals`), not prompt rules; the worker (`src/pack`) does not import the new feature; no default exports; no magic numbers (constants at the top of `length.ts`). Re-checked after design: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/038-resume-length-control/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/length-target.md
├── checklists/requirements.md
└── tasks.md            (speckit-tasks)
```

### Source Code (repository root)

```text
src/resume/length.ts              NEW pure: CHARS_PER_PAGE, PageTarget, parse/read, lengthPlan, cutBudget, lengthLines
src/resume/length.test.ts         NEW
src/resume/parse-warnings.ts      import CHARS_PER_PAGE (single definition)
src/resume/match-mode.ts          storedBreakdown meta gains `pages`
src/resume/match-reuse.ts         StoredMatch.pages; reuseDecision/pickReusable compare it
src/resume/match.ts               opts.pages -> context + createMatch; findReusableMatch(pages)
src/resume/store.ts               createMatch passes `pages` into storedBreakdown
src/resume/prompts.ts             MatchContext.length / SuggestionsInput.length; lengthLines in both user messages
src/resume/suggestions.ts         reads readPageTarget(match.breakdown)
src/web/comparison-run.ts         ComparisonRequest.pages; run key; findReusableMatch
src/web/routes/target.tsx         TargetFormSchema.pages; both startComparison/claimRun keys
src/web/routes/jobs.tsx           job-page Compare: carries keep (confirm in tasks)
src/web/pages/target-start.tsx    Length control
src/web/pages/target.tsx          meter element + embedded pageTarget/charsPerPage
src/web/public/length.mjs         NEW browser mirror
src/web/public/target-page.mjs    update the meter on every edit
src/web/length.test.ts            NEW parity test
src/i18n/catalog/*.json           new keys, every language (+ i18n:browser if browser.* keys)
docs/where-to-look.md, docs/adr/0073-*.md, docs/adr/README.md, docs/TASKS.md
```

**Structure Decision**: single existing web+worker repo; the feature lives in `src/resume/` (pure + prompts) and `src/web/` (form, run key, meter). `src/pack/` is not touched.

## Complexity Tracking

No violations to justify.
