---

description: "Tasks for result messages as toasts (#54)"
---

# Tasks: Result messages as toasts

**Input**: `specs/054-toast-flash-messages/` (spec.md, plan.md, research.md, data-model.md, contracts/toast.md, quickstart.md)

**Tests**: TDD for the pure parts (`toastPlan` in `src/web/toast.test.ts`); the route smoke for the `Flash` markup (the repo's unit tests do not compile JSX); the DOM glue and the layout are verified in a real browser (T016). Env for unit tests: `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci ANTHROPIC_API_KEY=sk-ci-dummy`. All paths relative to the worktree.

## Phase 1: Setup

- [x] T001 Baseline: `npm run lint:types` and `npm test` pass before any change

## Phase 2: Foundational — the module, the string, the markup (blocks every story)

- [x] T002 Write failing tests in `src/web/toast.test.ts` (import `./public/toast.mjs` the way `inline-post.test.ts` imports its module): `toastPlan({ kind, textLength, hasAction })` returns `{ sticky: true }` for `warn`, `err`, and for any kind with `hasAction`; for `ok` without an action returns `{ sticky: false, ms }` with `ms = clamp(4000 + 40 × textLength, 4000, 12000)` (length 0 → 4000, 100 → 8000, 1000 → 12000)
- [x] T003 Create `src/web/public/toast.mjs`: header comment in the style of `inline-post.mjs`; named constants `TOAST_MS = { base: 4000, perChar: 40, min: 4000, max: 12000 }`; pure `toastPlan`; `enhanceFlash(slot)` per `contracts/toast.md` (no-op and `data-toast` removed when the slot has no banner; idempotent close button labelled `t('browser.toast.dismiss')`; replaces the earlier timer and listeners; pointer-enter/focus-in pause and pointer-leave/focus-out restart; a banner counts as an action when it has `data-sticky` or any `a, button, input` other than its close button; closing sets `data-leaving`, then empties the slot after the transition and removes `aria-invalid`/`aria-describedby` added for a refused field; never calls `.focus()`); boot: `enhanceFlash()` once and one `document` keydown listener that closes the toast on Escape unless `event.defaultPrevented`. T002 passes
- [x] T004 [P] Catalog: add `browser.toast.dismiss` ("Dismiss message") to `src/i18n/catalog/{en,es,fr,uk}.json`, then `npm run i18n:browser` to regenerate `src/web/public/i18n-en.mjs`; `src/i18n/catalog.test.ts` and `src/web/i18n-browser.test.ts` pass
- [x] T005 [P] Add the `Flash` markup assertions to `src/scripts/route-smoke.ts` (see T012) — the unit-test runner does not compile JSX, so markup is asserted through real pages: an empty `#flash-slot[data-region]` on a page with no message; `role="alert"` on an error flash, `role="status"` on ok/warn; `data-sticky` on a message with an action, none on a plain ok
- [x] T006 `src/web/ui.tsx` `Flash`: `role` by kind (`alert` for `err`, else `status`); `data-sticky` on the banner when `children`, `flash.download` or `flash.tailor` is set; markup otherwise unchanged. T005 passes

**Checkpoint**: module and markup exist and are tested; nothing wired yet; every page still shows the banner.

## Phase 3: User Story 1 — See the result of what I just did (P1)

**Goal**: a message is a fixed popup that does not move the page and a plain success leaves by itself.

**Independent test**: scroll a page to the bottom, trigger a success: the message is on screen, nothing shifts, it leaves in 4–12 s; the close button and Escape close it.

- [x] T007 [US1] `src/web/layout.tsx`: CSS in the inline stylesheet for `#flash-slot[data-toast]` per `contracts/toast.md` — `position: fixed`; `bottom`/`right` 1rem at ≥ 640 px, `left`/`right` 1rem below; `z-index` 50 (above the mobile sidebar 40, below progress 60); `max-width: 28rem`; `max-height: calc(100dvh - 2rem)`, `overflow: auto`; `background: rgb(var(--surface-raised))`, `border-radius: 0.375rem`, a card shadow from `--shadow-ink`; the banner inside has `margin: 0` and gains `padding-right` for the close button; the close button (`[data-toast-close]`) is positioned top-right with a 44×44 px hit area, `currentColor` icon, visible `:focus-visible` ring; entrance via `@keyframes toast-in` (opacity + 0.5rem translate, 160 ms) and `[data-leaving]` fade; no `prefers-reduced-motion` rule of its own (the global one applies)
- [x] T008 [US1] `src/web/layout.tsx`: add `TOAST_BOOT` (`import { enhanceFlash } from '/static/toast.mjs';` — the module boots itself) as a `<script type="module">` beside `PROGRESS_BOOT`
- [x] T009 [US1] Verify in a browser (scratch install, quickstart steps 4–5): bottom-right on desktop, full width with gutters on a phone, content does not shift, readable in light and dark, leaves by itself, close button and Escape work, pause on hover. Fix CSS until it holds

**Checkpoint**: US1 works on every page whose message loads with the page.

## Phase 4: User Story 2 — Problems and choices do not vanish (P1)

**Goal**: warnings, errors and messages with an action stay; a refused field stays marked.

**Independent test**: an error, a warning and a "Re-run anyway" message are all still there after a minute; each closes on demand.

- [x] T010 [US2] Verify in a browser (quickstart step 6) and fix: an error stays and is red with `role="alert"`; a warning stays; the "Re-run anyway" form on the tailor/match page works inside the popup; a refused field is `aria-invalid` and described by `#flash-text`, and both are removed when the message closes

## Phase 5: User Story 4 — Without scripts, and with edits in place (P2)

**Goal**: no-script keeps the banner; #53's in-place posts show their result and their failure as toasts.

**Independent test**: scripts off → the banner; scripts on, change a keyword on the tailor page → a toast, no scroll.

- [x] T011 [US4] `src/web/public/inline-post.mjs`: import `enhanceFlash` from `./toast.mjs`; call it after `swapRegions` replaced the regions (replacing the `announce(flash.textContent)` block — the banner's own role announces it) and in `showFailure` after the line is inserted (drop its `announce(message)`); give `FAILURE_CLASS`'s line `role="alert"` as now; remove the `announce` import if it is no longer used; update the header comment and `specs/053-tailor-edits-no-reload/contracts/inline-regions.md` only where it says the slot is announced by the module
- [x] T012 [US4] Extend `src/scripts/route-smoke.ts`: the match tab/tailor page HTML still carries `id="flash-slot"`; a flash set by a POST renders with `role="status"` (and a refusal with `role="alert"`) on the page it lands on; `/static/toast.mjs` is served as JavaScript and imported by the layout; every page in the pseudo-language run stays clean
- [x] T013 [US4] Verify in a browser (quickstart steps 4, 6, 7): keyword edit on the tailor page and the match tab → toast, scroll and focus unchanged, a second edit replaces the first; offline/failed save → an error toast that stays; JavaScript disabled → the top banner and working forms

## Phase 6: User Story 3 — Everyone is told; no forced motion (P2)

- [x] T014 [US3] Verify (quickstart steps 8–9) and fix: reduced motion removes the slide/fade (emulate in DevTools); the close button is reachable by Tab and closes on Enter/Space with focus staying where it was (never on `body`); a message appearing while typing does not move focus; a success is spoken once (spot check with a screen reader if available, else confirm by reading the DOM that only the banner has a live role and no second live region is written)

## Phase 7: Polish & cross-cutting

- [x] T015 [P] Docs: ADR `docs/adr/0082-flash-messages-as-toasts.md` (Context / Decision / Alternatives / Consequences, as 0081) + index row in `docs/adr/README.md`; `SPEC.md` (result messages), `ARCHITECTURE.md` file map (`public/toast.mjs`, `toast.test.ts`), `DESIGN.md` if it describes the flash/banner, `CHANGELOG.md` `## [2.59.17] — 2026-10-17` ("Changed: result messages appear as a popup…"), `package.json`/`package-lock.json` version 2.59.17 (patch only), and any README/docs line that says a message "appears at the top"
- [x] T016 Full verification (superpowers:verification-before-completion): `npm run lint:types`, `npm test`, `npm run exports:audit`, `npm run i18n:browser` (no diff), `npm run build`, route smoke on a throwaway Postgres, browser check at 1280×800 and 390×844 in light and dark; mark the quickstart steps and these tasks complete

## Dependencies

T001 → T002/T004/T005 → T003/T006 → T007/T008 → T009 (US1) → T010 (US2) → T011 → T012/T013 (US4) → T014 (US3) → T015/T016. T004 and T005 are parallel with T002; T015 can run alongside T012–T014.

## Implementation strategy

MVP is Phase 2 + US1 (T001–T009): the popup with auto-close and manual close. US2 is mostly verification because stickiness is built into `toastPlan`/`Flash`; US4 wires #53's flow; US3 is verification of what the CSS and markup already do.
