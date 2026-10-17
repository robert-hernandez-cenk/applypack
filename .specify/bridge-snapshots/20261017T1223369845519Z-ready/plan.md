# Implementation Plan: Result messages as toasts

**Branch**: `issue-54-toast-flash-messages` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/054-toast-flash-messages/spec.md`

## Summary

Every result message is rendered by one component (`Flash`, `src/web/ui.tsx`) into `#flash-slot`. The server keeps
rendering the banner exactly as now (the no-script fallback). A new dependency-free browser module,
`src/web/public/toast.mjs`, turns the slot into a toast when script runs: the slot is pinned to the viewport,
gets a close button, and closes itself after a length-dependent time when the message is a plain success.
`inline-post.mjs` (#53) calls the same function after it swaps regions and when it writes its failure line.
No route, cookie or message wording changes. See [research.md](./research.md) for the decisions.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (server); plain ES modules served from `src/web/public/` (browser)

**Primary Dependencies**: none new (Hono JSX; the toast CSS is hand-written in `layout.tsx`'s inline stylesheet so the committed `tailwind.css` needs no rebuild unless a new utility class is used)

**Storage**: N/A

**Testing**: `node --test` via `tsx`; the module's pure decisions are imported from the `.mjs` as `inline-post.test.ts` does; DOM glue and layout verified in a browser at desktop and phone widths, light and dark; route smoke (incl. pseudo-language) for pages

**Target Platform**: the dashboard in current evergreen browsers; no-script browsers get the banner

**Project Type**: web service (server-rendered dashboard with progressive-enhancement modules)

**Performance Goals**: none beyond "no layout shift" (the slot is out of flow when it is a toast)

**Constraints**: no new third-party script; strings through `t()`/catalog in en, es, fr, uk; WCAG 2.2.1 (timing adjustable: pause on hover/focus, errors and actions never time out), 4.1.3 (status messages), 2.3.3 (reduced motion)

**Scale/Scope**: 29 `<Flash>` call sites, one component; 1 new module, 1 new catalog key

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template: no project gates. The repo's `CLAUDE.md` rules apply and are
met: named exports only, no new external data, no magic numbers (durations are named constants at the top of
`toast.mjs`), pure decisions are unit-tested, UI changes are checked in a browser, the new string goes through the
catalog, an ADR records the decision, and the release is a patch bump.

Re-check after design: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/054-toast-flash-messages/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── toast.md
└── tasks.md          (by /speckit-tasks)
```

### Source Code (repository root)

```text
src/web/
├── ui.tsx                     # Flash: role=alert for err; marks a message with an action; keeps the banner
├── layout.tsx                 # CSS for #flash-slot[data-toast]; boots toast.mjs on every page
├── public/
│   ├── toast.mjs              # NEW: toastPlan() (pure) + enhanceFlash() (DOM) + boot
│   ├── inline-post.mjs        # calls enhanceFlash after a swap and in showFailure; stops double-announcing
│   └── i18n-en.mjs            # regenerated (npm run i18n:browser)
├── toast.test.ts              # NEW: toastPlan
└── flash-markup.test.ts       # NEW: Flash markup (role by kind, sticky marker, slot always present)
src/i18n/catalog/{en,es,fr,uk}.json   # browser.toast.dismiss
src/scripts/route-smoke.ts     # asserts the slot, role=alert on an error, the toast module is served
docs/adr/0082-flash-messages-as-toasts.md (+ README index)
SPEC.md, ARCHITECTURE.md, DESIGN.md, CHANGELOG.md, package.json (2.59.17)
```

**Structure Decision**: one shared component and one browser module, mirroring `inline-post.mjs` (pure exports
tested from node, DOM glue below them). No new route.

## Complexity Tracking

None.
