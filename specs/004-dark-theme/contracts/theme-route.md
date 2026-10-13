# Contract: `POST /settings/theme`

Changes the appearance for this browser.

## Request

- Method/path: `POST /settings/theme`
- Body (`application/x-www-form-urlencoded`, small; the global body limit applies):
  - `theme`: `system` | `light` | `dark`
  - `back`: the page to return to (path and query, optionally `#fragment` added by the browser-side helper shared with the language form); passed through `safeBack`, which refuses anything off-site and falls back to `/`
- Same-origin only: the existing `originGuard()` refuses a cross-origin POST with the same response every other POST gets.
- Sign-in (OIDC / Basic Auth), when configured, applies as for every route.

## Response

- `303 See Other` to `safeBack(back)`.
- `theme=light|dark`: `Set-Cookie: theme=<value>; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly` (`; Secure` on HTTPS).
- `theme=system`: the cookie is deleted (`Max-Age=0`).
- Unknown or missing `theme`: no cookie change, same redirect.
- No flash message: the page changing is the confirmation.

## Rendering contract

Every page rendered through `Layout` (and the sign-in page) emits `<html data-theme="light|dark">` when the cookie holds one of those values and emits no `data-theme` attribute otherwise. The stylesheet maps those states to the token sets (see research.md §2).
