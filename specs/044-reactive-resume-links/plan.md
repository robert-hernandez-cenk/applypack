# Implementation Plan: Keep profile and page links when importing from Reactive Resume

**Branch**: `issue-44-reactive-resume-links` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/044-reactive-resume-links/spec.md`

## Summary

**Amended after the live check (research R8):** the real export keeps its LinkedIn and GitHub links in `basics.customFields[].link`, which the importer drops, and the Markdown it writes (`# Name`, `### Role`) is read by `structureFromText` as a stack of section headings, so the parser finds no name, contact or place and one job of six. The fix therefore also writes custom-field links and moves the output to the plain-line dialect the reader already understands (story 3); the design below still holds for profiles and anchors.

`src/resume/reactive-resume.ts` writes a Reactive Resume export out as the Markdown a resume is stored as (ADR 0073). It loses links in three places: `profile()` keeps an address only when there is no username, `contactLine()` has no profiles at all (they trail the resume in a `## Profiles` section), and `plain()` strips every `<a href>` to its words. The fix stays inside that one pure module: profiles move into the header contact line as bare addresses, the trailing section goes, and `plain()` rewrites a link to `words (address)` before the existing tag strip, with a linear, bounded scan so a hostile description cannot cost seconds. Both ways in (file upload, pull from an instance) already go through `reactiveResumeText`, so neither needs a change. No schema, route, prompt, catalog or dependency changes.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)

**Primary Dependencies**: none new; `zod` and `stripHtml` (`src/http.ts`) already used by the module

**Storage**: N/A — the module is pure; the Markdown it returns is stored by `resume/store.ts` as before

**Testing**: Node's built-in runner, `src/resume/reactive-resume.test.ts` with the v4/v5/v6 fixtures; touched files run directly with `node --import tsx --test`

**Target Platform**: web process only (the worker never imports `src/resume/reactive-resume.ts`)

**Project Type**: single TypeScript service (worker + Hono dashboard); this change touches neither entry point

**Performance Goals**: a 300 000-character description of unterminated link markup reads in under one second (SC-004)

**Constraints**: pure module (no I/O); output unchanged for a resume with no profiles and no links (FR-011); `.md` output of every other upload kind unchanged (FR-012)

**Scale/Scope**: one module (~250 lines), one test file, one fixture touched; a resume holds tens of profile and link entries at most

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template, so the gates are the repository's own rules in `CLAUDE.md`:

| Rule | Status |
|------|--------|
| Pure functions; side effects in dedicated modules | Pass — the change is inside a pure module and adds no I/O |
| No default exports, named exports only | Pass — no new exports planned |
| zod for external data | Pass — the module already reads the export through `unknown` + guards; unchanged |
| No magic numbers; constants at the top of the file | Pass — the link-scan bounds become named constants |
| `exports:audit` — no dead or over-exported export | Pass — helpers stay unexported |
| Tests cover pure modules | Pass — unit tests are the verification |
| `src/i18n/` — a string a person reads is a catalog key | Pass — no person-facing string added; the Markdown is data, not interface text |
| Patch releases only (owner's standing rule) | Pass — 2.59.7 → 2.59.8 |
| ADR for architecture/interface changes | Pass — none; an addendum line to ADR 0073 records the output change |

Re-check after design: unchanged, no violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/044-reactive-resume-links/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── imported-markdown.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/resume/
├── reactive-resume.ts                       # profile(), contactLine(), plain(), SECTIONS — the whole change
├── reactive-resume.test.ts                  # the GitHub assertion changes; profile and link cases added
└── fixtures/reactive-resume/                # v4.json / v5.json / v6.json (+ hidden-and-html.json) gain profile and link cases

docs/adr/0073-reactive-resume-import-reads-a-file-or-asks-the-owners-instance.md   # one addendum line
CHANGELOG.md                                 # 2.59.8 entry
package.json / package-lock.json             # version 2.59.8
```

**Structure Decision**: single existing project; the feature is a behaviour change inside `src/resume/reactive-resume.ts`. The upload and pull routes, `resume-text.ts` and the structure step are read-only context.

## Complexity Tracking

No constitution violations to justify.
