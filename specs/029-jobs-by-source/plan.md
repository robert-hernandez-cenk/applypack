# Implementation Plan: Jobs by source panel on the Overview

**Branch**: `issue-29-jobs-by-source` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

## Summary

Add a "Jobs by source" card under "Jobs by stack" on the Overview. It groups the last-30-days matches the stack card already loads by the source each came through: per-company vendor boards merge into one "Company boards" entry, every other source stands alone. One extra column on an existing select, one pure grouping function, one card, a few catalog keys. No schema change, no new query.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (>=22)
**Primary Dependencies**: Hono (server JSX), Prisma 6 — nothing new
**Storage**: Postgres; read-only (`user_job` → `job` → `company.atsType` added to a select that already runs)
**Testing**: `node --test` over `src/**/*.test.ts`, `npm run lint:types`; the grouping is pure and unit-tested in `overview-numbers.test.ts`; the card is covered by the route smoke (including the pseudo-language pass) and a browser check
**Target Platform**: the dashboard, desktop and phone widths
**Project Type**: web dashboard (separate from the cron worker)
**Performance Goals**: no added query; the select gains one joined column on rows it already reads (≤ the person's last 30 days of matches)
**Constraints**: CLAUDE.md — pure helper, named exports, no magic numbers, every visible string a key in all four catalogs, `npm run css` if a new Tailwind utility appears (the card reuses the stack card's classes, so none is expected), `data-ui="hint"` on the helper paragraph
**Scale/Scope**: hundreds of rows per person; ≤ 8 bars drawn

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so there are no gates from it. The repo's `CLAUDE.md` rules apply and the plan honours them: pure module + test, i18n in all catalogs in the same PR, `where-to-look.md` row updated, `data-ui` hook on helper prose, `translate="no"` on names that are data.

## Project Structure

### Documentation (this feature)

```text
specs/029-jobs-by-source/
├── plan.md
├── research.md
├── quickstart.md
└── tasks.md   # next stage
```

### Source Code

```text
src/web/overview-numbers.ts          # + SourceCount, topSources (pure), BOARDS key
src/web/overview-numbers.test.ts     # + topSources tests
src/web/overview-stats.ts            # matchRows select gains job.company.atsType; stats.sources
src/web/pages/overview.tsx           # second Card after "Jobs by stack"
src/i18n/catalog/{en,es,fr,uk}.json  # title, info, "Company boards", footer
docs/where-to-look.md                # the Overview row for "which source brings the matches"
```

**Structure Decision**: `topSources` lives beside `topTerms` — same shape, same file, same test file. It stays free of the language: it returns a key (`BOARDS` or an `atsType`), and the page words it with `source-names.ts:sourceLabel` so the function needs no locale to be tested.

## Design

- **Select**: `matchRows`'s `userJob.select` gains `job: { select: { fetchedAt, company: { select: { atsType } } } }`, and the `.then` map carries `atsType` through beside `techMatch` and `fetchedAt`. Nothing else that reads `matchRows` changes (`options`, the chart series, `activity` ignore the new field).
- **`topSources(rows: { atsType: string }[], max)`** → `SourceCount[]` `{ source, count, share }`: `source` is `COMPANY_BOARDS` when `sourceFamily(atsType) === 'vendor'`, else the `atsType`. Counted per row (a posting has one source), sorted by count desc then `source` asc (stable, like `topTerms`), cut to `max`, `share` = 0–100 against the largest.
- **Stats**: `OverviewStats.sources: { entries: SourceCount[]; matches: number }`, `matches` being `matchRows.length`, loaded with `SOURCE_BARS = 8` (same number as `STACK_BARS`; one named constant each, no sharing, so the two cards can diverge).
- **Page**: `Card` + `CardHeader` (title, `info`, "30 days" chip) + `<ul>` of rows with the stack card's markup minus the `<a>`: label, bar, count; footer hint `data-ui="hint"` with the plural total. The label span carries `translate="no"` for a name (vendor/aggregator) and not for a worded kind (Gmail, Folder, Import, Manual, Feed, Careers page) or "Company boards" — `wordedSource` from `source-groups.ts` decides. Rendered `{stats.sources.entries.length > 0 && …}`; both cards sit in the same column.
- **Words**: `overview.jobsBySource`, `overview.theSourcesBehindTheMatches` (info), `overview.source.companyBoards`, `overview.source.outOf` (plural footer). Written in en, es, fr, uk.
- **Accessibility**: the bar is decorative (`aria-hidden`) as in the stack card; each row's text carries label and count, so nothing relies on colour or the bar.

## Complexity Tracking

None.
