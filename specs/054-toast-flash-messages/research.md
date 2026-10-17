# Research: Result messages as toasts

No external APIs or formats are involved; the decisions below are about the existing code.

## What exists

- `Flash` (`src/web/ui.tsx`) renders `<div id="flash-slot" data-region class="empty:hidden">` always, and inside it, when a
  message exists, a `role="status"` banner (icon, `#flash-text`, optional download link, optional `children` — the
  message's one action) plus an optional module script that marks a refused field invalid.
- `inline-post.mjs` replaces `[data-region]` elements by id after an in-place post, so the slot **element is replaced**
  on every swap; `showFailure()` writes an error line straight into the slot; `swapRegions()` calls `announce()` with
  the slot's text although the banner already has `role="status"`.
- Callers pass `children` only for a message with an action (Re-run anyway on the tailor page, etc.); a download link
  is `flash.download`; a "Tailor resume →" link is `flash.tailor`.
- Layout loads one inline boot script per module (`PROGRESS_BOOT`); the global `prefers-reduced-motion` rule
  already flattens every transition and animation.

## Decisions

### D1 — One component, progressive enhancement
- **Decision**: keep the server markup; `toast.mjs` adds `data-toast` to `#flash-slot` and the CSS does the rest.
- **Rationale**: the banner is the required no-script fallback; one place covers all 29 call sites and the in-place flow.
- **Alternatives**: a server-rendered toast container plus a `<noscript>` banner (two renderings that can drift);
  a JSON/`Set-Cookie` read in the browser (changes how messages travel, out of scope).

### D2 — Position: bottom-right (wide), bottom with gutters (narrow)
- **Decision**: `position: fixed` on the slot, `bottom` + `right` at ≥ 640 px, `left`/`right` 16 px gutters below.
  `max-width: 28rem`, `max-height: calc(100dvh - 2rem)` with `overflow: auto`, `z-index` above the mobile sidebar (40)
  and below the navigation progress bar (60).
- **Rationale**: the header buttons that cause most messages are at the top; the sidebar is at the left.
- **Alternatives**: top-right (covers those buttons); centre-top (covers the page title).

### D3 — Readable over content
- **Decision**: the slot gets `background: rgb(var(--surface-raised))`, the banner's radius and a card shadow; the
  existing tinted banner sits on it.
- **Rationale**: the tones are `bg-*/5` — translucent — so over page text they would be unreadable. Tokens already have
  light and dark values, so one rule serves both looks.
- **Alternatives**: opaque per-tone colours (new tokens, a tailwind rebuild).

### D4 — When a message closes by itself
- **Decision**: `toastPlan({ kind, textLength, hasAction })` → `{ sticky: true }` for `warn`, `err`, or any message with
  an action/download; otherwise `{ sticky: false, ms }` with `ms = clamp(BASE + PER_CHAR × length, MIN, MAX)` =
  clamp(4000 + 40 × length, 4000, 12000) ms. A timer pauses on pointer-enter and focus-in and restarts (full time) on
  leave and focus-out.
- **Rationale**: matches the issue (errors/warnings stay) and SC-002 (4–12 s); an action must not vanish (users
  scroll to reach it).
- **Alternatives**: one fixed delay (long messages unreadable); closing on any user activity elsewhere (surprising).

### D5 — How "has an action" is known
- **Decision**: `Flash` marks the banner `data-sticky` when it has `children`, `download`, or `tailor`; the module also
  treats any interactive element inside the banner other than its own close button as an action.
- **Rationale**: the server knows; the DOM check is a safety net for a banner built elsewhere (`showFailure`).

### D6 — Announcements without doubling
- **Decision**: the banner carries the live role (`alert` for `err`, `status` otherwise) and is the only announcer;
  `swapRegions()` stops calling `announce()` for the slot. `showFailure()` keeps `role="alert"` and also stops calling
  `announce()`.
- **Rationale**: avoids a second spoken copy (SC-004). `role="status"` / `role="alert"` elements added to the page
  are announced by current screen readers, and the server-rendered banner relies on the same behaviour today. No
  `aria-live` on the slot: nesting a live region around a role'd banner can speak it twice.
- **Alternative**: keep `announce()` and make the banner `aria-hidden` while toasting (hides the close/action buttons
  from assistive technology — rejected).

### D7 — Focus
- **Decision**: never call `.focus()` on the toast; the close button is the last tabbable in the banner; Escape
  anywhere closes the current toast (a keydown listener on `document`, ignored when the event is already handled,
  e.g. closing a menu).
- **Rationale**: SC-006.

### D8 — Replace, not stack
- **Decision**: the slot is single; `enhanceFlash` clears the previous timer and listeners before arming a new one.

### D9 — Leaving
- **Decision**: closing removes the banner's children (the slot becomes `:empty` and hidden by the existing
  `empty:hidden`), after a short opacity/translate transition that the global reduced-motion rule flattens; the
  field-linked `aria-describedby` is cleaned off the field when its message closes.
- **Rationale**: avoids a dangling reference to a removed element.

### D10 — Strings
- **Decision**: one key, `browser.toast.dismiss` ("Dismiss message"), in all four catalogs; `i18n-en.mjs` regenerated;
  the pseudo-language embed picks it up from the catalog like every `browser.*` key.
