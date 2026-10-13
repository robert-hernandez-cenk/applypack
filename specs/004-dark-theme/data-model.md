# Data Model: Dark theme

No database change. Two small value types.

## Theme (appearance choice)

| Field | Type | Rules |
| --- | --- | --- |
| value | `'system' \| 'light' \| 'dark'` | `system` is the default and the meaning of "no cookie" |

- Source: the `theme` cookie. `parseTheme(raw: unknown): Theme` is total: `'light'` and `'dark'` map to themselves; anything else, including `undefined`, maps to `'system'`.
- `themeAttr(theme)`: `'light'` / `'dark'` for those two values, `undefined` for `system` (so the `<html>` element carries no `data-theme` and the media query decides).
- Stored form: `system` is stored as the absence of the cookie (the route deletes it).

## Token set

`Record<TokenName, Rgb>` with the keys of `TOKENS` (surface, surface-raised, surface-overlay, surface-selected, line, line-strong, ink, ink-muted, ink-faint, accent, accent-strong, accent-deep, ok, warn, danger, info, violet), plus the two non-colour tokens added for this feature if the plan needs them (`shadow-ink`, `scrim`). `LIGHT_TOKENS` is the existing `TOKENS`; `DARK_TOKENS` has the same keys (enforced by `satisfies`).

## State transitions

`system` ⇄ `light` ⇄ `dark`: any value to any value, by a POST to the theme route. No other transitions.
