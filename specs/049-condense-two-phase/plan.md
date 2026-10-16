# Implementation Plan: Condense as its own two-phase stage

**Branch**: `issue-49-condense-two-phase` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/049-condense-two-phase/spec.md`

## Summary

Cuts and wording-tightening leave the combined comparison/suggestions requests and become a stage of their own, started from the tailoring editor: **Find cuts** (Phase A), **Tighten wording** (Phase B, on the editor text left after accepted cuts), then an optional **Refresh suggestions** on the condensed text. The main prompts lose the removal rules, the removals output and the page-length block. Everything an unattended edit may touch is still decided in code (the existing removal and replacement gates).

## Technical Context

**Language/Version**: TypeScript strict, Node 24

**Primary Dependencies**: Hono (server JSX), Prisma + Postgres 16, zod, existing `askForJson` / `ai-runtime`

**Storage**: Postgres. New `resume_match.condense` JSON column (default `{}`); cuts reuse `resume_match.removals`; furthest step rides in `breakdown.condense`

**Testing**: `node --test` over pure modules (`condense.test.ts`, updated `prompts.test.ts`, `length.test.ts`, fence registry, i18n catalog, route smoke); a real-key run for the live check

**Target Platform**: the dashboard (web service); the worker never imports resume modules for this feature

**Project Type**: web-service (existing)

**Performance Goals**: each step is one AI call; a repeat press joins the run in flight

**Constraints**: no new dependency; prompts fenced (`fence()`); labels in `ai-usage.ts`; every shown word in all catalogs; migration hand-written (gotcha 7)

**Scale/Scope**: one new pure module, one AI-call module, one run module, three routes, one panel, one migration

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template; the binding rules are the repo `CLAUDE.md`. Checked: pure/side-effect split (`condense.ts` pure, `condense-call.ts` AI + store); every prompt builder fenced and in the fence registry; labels registered; model-controlled limits live in code (gates), not in prompt rules (gotcha 11); i18n in all catalogs; no worker import; route lists unchanged (new routes sit under the existing personal `/jobs/...` prefix). No violations.

## Project Structure

### Documentation (this feature)

```text
specs/049-condense-two-phase/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/routes.md
└── tasks.md
```

### Source Code

```text
src/resume/condense.ts            NEW pure: rules, schemas, builders, parsers, shorter-only gate, marker, panel state
src/resume/condense.test.ts       NEW
src/resume/condense-call.ts       NEW AI calls (cuts, words), gates, persistence
src/resume/prompts.ts             drop RULE_REMOVALS/OUTPUT_REMOVALS/lengthLines use; SuggestionsSchema without removals; PROMPT_VERSION 17
src/resume/length.ts              drop lengthLines/lengthExtraTokens from main path (kept for condense)
src/resume/match.ts, suggestions.ts  no length/removals; suggestions take a text override and keep stored removals
src/resume/store.ts, match-mode.ts   condense column + marker writers
src/ai-usage.ts, ai-spend.ts, ai-tasks.ts   two new labels
src/web/condense-run.ts           NEW run claim (like suggestions-run.ts)
src/web/routes/jobs.tsx           three POST routes
src/web/pages/condense-panel.tsx  NEW panel; target.tsx mounts it, wording proposals join the change cards
src/web/public/target-page.mjs    posts the editor text with the condense forms
src/i18n/catalog/*.json           new keys, all languages
prisma/schema.prisma + migration  condense column
docs/adr/                         new ADR; docs/where-to-look.md, CLAUDE.md, SPEC.md, CHANGELOG
```

**Structure Decision**: follow the module/route pattern of ADR 0029 (quick check + lazy suggestions) and `suggestions-run.ts`.

## Complexity Tracking

None.
