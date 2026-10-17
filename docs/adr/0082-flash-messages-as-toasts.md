# 0082 — A result message is a toast: the server keeps rendering the banner, one browser module pins it to the corner

**Status:** Accepted (2026-10-17). Issue #54. Builds on [0081](./0081-inline-keyword-edits.md) (the flash slot is a
swapped region and `inline-post.mjs` writes its failure line there) and on [0061](./0061-the-interface-speaks-several-languages.md)
(browser modules speak through `t()`).

## Context

Every result message ("`"prototype development" is now preferred — score stays 83, no AI call.`") was a banner at the
top of the page, rendered by one component (`Flash`, `ui.tsx`) in 29 places. It pushed the content down by its own
height and, on a scrolled page, sat above the viewport. After 0081 made keyword edits save in place, the page stayed
scrolled where it was and the message appeared where nobody was looking.

## Decision

- **One component, progressive enhancement.** `Flash` still renders the banner into `#flash-slot`; that is exactly
  what a browser without script shows. `public/toast.mjs` (loaded by the layout on every page) marks the slot
  `data-toast`; layout CSS then makes the slot `position: fixed` at the bottom of the viewport: bottom-right at 28 rem
  on wide screens, full width with 1 rem gutters on narrow ones. A one-line script in the head sets `html[data-js]` so the
  popup place applies from first paint (no jump when the module loads). No server-side script detection, no second rendering.
- **Bottom, on a raised surface.** The header buttons that cause most messages are at the top. The tones are
  translucent, so the slot carries a solid `surface-raised` ground, a radius and a shadow; the same tokens serve both looks.
- **When a message leaves.** `toastPlan({ kind, textLength, hasAction })`: a warning, an error, or any message that
  offers something to do (`data-sticky`, or a control inside it) stays until closed; a plain success closes after
  `clamp(4000 + 40 ms × characters, 4 s, 12 s)`. The timer stops while the pointer is on the message or focus is
  inside it. Every message has a close button (label `browser.toast.dismiss`) and Escape closes it. Nothing takes focus.
- **One announcement.** An error is `role="alert"` (it was `status` for all). A message that arrives by an in-place post
  is spoken once through the page's persistent polite live region and its banner drops `role="status"`, because a status
  element inserted already filled is not reliably read and keeping both spoke it twice. `inline-post.mjs` calls
  `enhanceFlash(slot, { spoken: true })` after a region swap and after writing its "not saved" line. The tone is `data-kind`
  on the banner, not its classes.
- **One message at a time.** The slot is single: a newer message replaces the one on screen; no queue, no history.
- **Reduced motion.** The entrance and leave animations fall under the global `prefers-reduced-motion` rule, and the
  leave delay is skipped.

## Alternatives considered

- **A toast container rendered by the server plus a `<noscript>` banner**: two renderings of one message that drift.
- **Top-right**: covers Fetch now, Save and the other header actions that produce the message.
- **Auto-dismiss everything**: a failure missed by looking away, a button gone as the pointer reaches it. WCAG 2.2.1.
- **Keep `announce()` and hide the banner from assistive technology while it is a toast**: hides the close button and
  the message's own action from them.
- **A toast stack and a history panel**: more machinery than the single slot the page already has; nobody asked.

## Consequences

✅ The result of an action is on screen wherever the page is scrolled; the page does not move.
✅ All 29 call sites and the in-place flow change together; producing a message (cookie, `flashRedirect`) is untouched.
✅ Without script the banner is what it was.
❌ A toast covers the bottom corner of the page for a few seconds; content under it is out of reach until it leaves or is closed.
❌ A message with an action stays until closed, so a person who ignores it keeps a popup over the corner.
❌ The decision of which messages stay rests on the banner's markup (`data-sticky`, controls inside); a new kind of
message with an action must go through `Flash`'s `children`, `download` or `tailor`, or carry `data-sticky` itself.

## When to revisit

A second message that must show at once (a stack), or a place where a toast is the wrong shape (a long refusal a person
must read and compare with a form, which should stay in the page).
