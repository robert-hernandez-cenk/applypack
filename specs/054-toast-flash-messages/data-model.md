# Data Model: Result messages as toasts

No stored data and no schema change. The message stays what `FlashMessage` (`src/web/flash.ts`) already is
(`kind`, `text`, optional `rerun`/`mode`/`pages`, `tailor`, `download`, `field`), carried in the one-shot cookie.

## Toast plan (browser, derived, never stored)

| Field | Type | Rule |
|-------|------|------|
| `kind` | `ok` \| `warn` \| `err` | from the banner's tone |
| `textLength` | number | length of the banner's text |
| `hasAction` | boolean | `data-sticky` on the banner, or any control/link in it besides the close button |
| result `sticky` | boolean | `kind !== 'ok'` or `hasAction` |
| result `ms` | number (only when not sticky) | `clamp(4000 + 40 × textLength, 4000, 12000)` |

## States of the slot

`empty` → (banner present, script ran) `toast, open` → (timer, close button or Escape) `closing` → `empty`.
A new banner while `toast, open` re-enters `toast, open` with a fresh timer. Without script: `banner` (in flow) — never leaves.
