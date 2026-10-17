# Implementation Plan: Keyword edits that keep your place

**Branch**: `issue-53-tailor-edits-no-reload` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/053-tailor-edits-no-reload/spec.md`

## Summary

Keyword edits are plain form posts answered with a 303 and a flash cookie, so every edit is a full page load. A new
dependency-free browser module (`public/inline-post.mjs`) lets forms that opt in (`data-inline`) post with `fetch`,
follow the same redirect, and replace named regions (`data-region`, matched by id) of the current page with those of
the page that comes back. The server does not change: it answers every client the same way. On the tailor page the
live scorer takes the fresh `#target-data` through a new `refresh()` so the ring, highlights and chips follow the new
keyword levels without touching the editor.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22); browser code is plain ES modules

**Primary Dependencies**: Hono JSX (server-rendered); no new dependency; `fetch`, `FormData`, `DOMParser` in the browser

**Storage**: none (no schema change, no migration)

**Testing**: `node:test` via `npm test`; browser modules are imported in tests, their pure parts tested; DOM glue is
checked in a real browser (Playwright) and by the route smoke for the markup

**Target Platform**: server-rendered dashboard, desktop + mobile browsers

**Project Type**: web application (single package)

**Performance Goals**: one extra page render per edit (accepted in the issue); no visible jump

**Constraints**: four interface languages + the pseudo-language pass; `exports:audit` forbids dead or over-exported
exports; `accessible-interactions` (focus, live regions); CLAUDE.md "no console.log", named exports only

**Scale/Scope**: 1 new module + test, edits to ~5 existing files, 4 catalogs, 1 ADR, docs

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so there are no project gates from it. The binding
rules are the repo's `CLAUDE.md` and skills: named exports only, pure modules tested, catalog keys in all four
languages (`browser.*` keys are mirrored into `public/i18n-en.mjs` by `npm run i18n:browser`),
`accessible-interactions` for focus and announcements, `adr-writer` for the decision record, `testing-gate`,
`commit-discipline`. Re-checked after design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/053-tailor-edits-no-reload/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── inline-regions.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/web/public/
├── inline-post.mjs            # NEW: intercept, post, swap regions, focus, queue, fallbacks
└── target-page.mjs            # init() returns { refresh(data) }; readData(doc)
src/web/
├── inline-post.test.ts        # NEW: pure helpers
├── ui.tsx                     # Flash: always-present #flash-slot region
└── pages/
    ├── resume-match-card.tsx  # data-inline on keyword forms; regions on KeywordTable, score row, breakdown chips
    ├── target.tsx             # regions: score advice + ready line, delta box, keyword fold count; boot script
    └── job-detail.tsx         # boot script (wireInlinePosts)
src/i18n/catalog/{en,es,fr,uk}.json   # browser.inline.failed
src/web/public/i18n-en.mjs             # regenerated
docs/adr/0081-inline-keyword-edits.md  # NEW
ARCHITECTURE.md, CHANGELOG.md, package.json (2.59.16)
```

**Structure Decision**: one reusable module with a data-attribute contract instead of page-specific scripts, so the
next form that wants to stay in place only adds `data-inline` and region ids.

## Design

1. **Opt-in.** `<form data-inline>` is intercepted by `wireInlinePosts(document)` on `submit`. A form without the
   attribute, or a browser without `fetch`/`DOMParser`, takes the normal post.
2. **Post.** The module snapshots `new URLSearchParams(new FormData(form, submitter))` and the form's `action` at
   submit time (so a queued edit survives its form being replaced) and calls `fetch(action, { method: 'POST', body,
   headers: { 'content-type': 'application/x-www-form-urlencoded' }, credentials: 'same-origin' })`. `fetch` follows
   the 303; the flash cookie is set by the POST and consumed by the followed GET, so the returned page carries the
   message in its `#flash-slot`.
3. **Swap.** `planSwap(currentIds, incomingIds, currentPath, finalPath)` (pure): if the final path differs from the
   current page's, or a current `[data-region]` id has no counterpart, the answer is `navigate` (go to
   `response.url`); otherwise the list of ids to replace. Each current region is replaced by `document.importNode`
   of the incoming one. `details` open states inside a region are carried over by `data-fold`.
4. **Focus, wiring, event.** Before the swap the focused control's key (`focusKey`: form action + hidden `term` +
   control name) is read; after it `pickFocus` chooses the matching control, else the first control of the same
   term, else the add field. `wireSelectCommits(region)` runs on each replaced region. Then
   `document.dispatchEvent(new CustomEvent('inline:swapped', { detail: { doc } }))`.
5. **Queue.** One request at a time, in submit order. A form already in flight ignores a second submit. While in
   flight the form has `aria-busy="true"` and reduced opacity (inline style; no Tailwind rebuild).
6. **Failure.** A thrown `fetch` or a non-OK final status writes `t('browser.inline.failed')` into `#flash-slot` as
   an error banner (same markup as `Flash`, built with DOM calls, text via `textContent`) and clears busy state.
7. **Tailor page.** `init()` returns `{ refresh(fresh) }` doing `Object.assign(data, fresh)` then `render()`. Every
   read of `data` inside `init` is live (checked: no value is copied at init), so this is enough. The boot script
   listens for `inline:swapped` and calls `refresh(readData(event.detail.doc))`.
8. **Regions.** Flash slot (`Flash`); `KeywordTable` root; on the tailor page: the advice and ceiling lines, the
   ready-to-apply line, the Delta box, the keyword fold summary; on the match tab: the score badge row, the
   breakdown chips with the Delta box. Wrappers that would add spacing use `empty:hidden`/`contents`.

## Risks

- **Stale server-rendered pieces outside the regions** (confirm-fact lists, Suggestions, reach line): they do not
  change content on a keyword edit except the confirm lists, which refresh on the next load. Recorded in research.
- **Double application of an edit**: avoided by snapshotting at submit and dropping a second submit of a form in
  flight.
- **Session ended**: the followed redirect lands on the login page: `planSwap` says navigate.
