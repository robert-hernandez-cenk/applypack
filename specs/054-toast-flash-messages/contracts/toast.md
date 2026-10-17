# Contract: the flash slot and `toast.mjs`

## Server markup (unchanged shape, two additions)

`Flash` always renders `<div id="flash-slot" data-region class="empty:hidden">`. When a message exists it holds one banner:

```html
<div role="status|alert" data-sticky?>   <!-- alert for kind err; data-sticky when it has an action -->
  <svg aria-hidden>…</svg>
  <span id="flash-text">text</span>
  <a href="…download">…</a>?  {children}?
</div>
<script type="module">…refused-field marking…</script>?
```

Without script this is the banner in the page flow, as before.

## `public/toast.mjs`

Pure exports (tested from node):

- `toastPlan({ kind, textLength, hasAction })` → `{ sticky: true } | { sticky: false, ms }` (see data-model.md).
- `TOAST_MS = { base: 4000, perChar: 40, min: 4000, max: 12000 }`.

DOM exports:

- `enhanceFlash(slot = document.getElementById('flash-slot'))`: if the slot holds a banner — set `data-toast` on the slot, add the close button (`aria-label` = `t('browser.toast.dismiss')`) as the banner's last
  child, drop any earlier timer/listeners, arm the timer per `toastPlan`, pause on pointer/focus. If it holds no
  banner, remove `data-toast` and do nothing else. Idempotent: running twice adds one button.
- boot: on module load, call `enhanceFlash()` once and add the Escape listener.

## Contract with `inline-post.mjs`

After `swapRegions()` replaced the slot, and after `showFailure()` filled it, `enhanceFlash()` is called. `inline-post.mjs`
no longer calls `announce()` for the slot's text. The `inline:swapped` event is unchanged.

## CSS (layout.tsx), selectors

`#flash-slot[data-toast]` — fixed, bottom/right (≥ 640 px) or bottom with 16 px gutters (< 640 px), solid raised
surface, `z-index` between the sidebar (40) and the progress bar (60), `max-width: 28rem`,
`max-height: calc(100dvh - 2rem)`, `overflow: auto`, entrance animation; its banner has no bottom margin.
`#flash-slot[data-toast][data-leaving]` — leave transition. The global `prefers-reduced-motion` rule removes both.
