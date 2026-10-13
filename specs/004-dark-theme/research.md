# Research: Dark theme

## 1. Where the choice is stored

- **Decision**: a `theme` cookie holding `light` or `dark`; absent (or cleared) means System. `Path=/`, `SameSite=Lax`, `HttpOnly` (no script needs it), one-year `Max-Age`, `Secure` only when the request is HTTPS.
- **Rationale**: the server renders `<html data-theme>` from it, so there is no flash and no script on the critical path. No schema change, no migration, and it is per browser, as the spec assumes. The language preference lives in `AppSettings` because it also words worker output; theme affects only the browser.
- **Alternatives**: `AppSettings` column (needs a migration, would apply to every browser, and the first paint would wait on a DB read that the middleware already does but that fails when the DB is down); `localStorage` + inline script (flash risk and an inline script the self-contained rules would have to allow).

## 2. How "System" works

- **Decision**: with no `data-theme`, a `@media (prefers-color-scheme: dark)` block applies the dark values to `:root:not([data-theme=light])`. `data-theme=dark` applies them unconditionally; `data-theme=light` keeps the light set.
- **Rationale**: pure CSS, follows OS changes live (FR-002), and a stale cookie can never override a cleared choice.
- **Alternatives**: JS `matchMedia` listener (needs script, flash).

## 3. Token emission

- **Decision**: `tokens.ts` gets `DARK_TOKENS satisfies Record<TokenName, Rgb>` so a missing key fails typing. `rootBlock()` returns three rules (light `:root`, `:root[data-theme=dark]`, the media-query rule) from a shared `declarations(tokens)` helper. `color-scheme` is set in the same rules so native controls, scrollbars and the form widgets go dark with them.
- **Dark values**: canvas near-black with a slight green-grey cast to echo the light canvas; raised surfaces one step lighter than the canvas (elevation reads as lighter in dark UIs); ink off-white (not pure white); status tones and the accent lifted in lightness so each clears AA on every dark surface; `accent-strong` (button fill and link text) is a lighter emerald for text and the button label turns near-black, or the fill stays dark with white text. Final numbers are chosen in implementation by running `tokens.test.ts`, which is the arbiter, not the eye.
- **Pill ground**: the pill's 12 % tint is painted over `surface-raised` already (`tailwind.css`); the test's `WHITE` base is replaced by the active set's `surface-raised`. No CSS change needed beyond the test.

## 4. Literal colours to convert

Found by grep over `src/web`:

| Site | Change |
| --- | --- |
| `ui.tsx:1045` toggle knob `bg-white` | keep white: it sits on an accent/neutral track in both themes; verify contrast of the track in dark |
| `shadow-sm/card/pop` in `tailwind.config.js` | read `--shadow-ink` (`13 20 33` in light, `0 0 0` in dark with higher alpha) |
| `backdrop:bg-[rgb(13_20_33/0.25)]` (`ui.tsx`, `language-menu.tsx`) and `.nav-backdrop`, sidebar shadow in `layout.tsx` | black-based scrim works on both; raise alpha slightly in dark via a `--scrim` token |
| favicon data-URI | emerald tile with white text is fine on both light and dark tab strips; unchanged |
| `pages/target.tsx` doc-pane CSS, `doc-pane.mjs` `background: #fff` | intentionally unchanged: the document is a white page (FR-011); only the surrounding well takes tokens |
| `text-white` on `bg-accent-strong` | stays legible if `accent-strong` keeps AA against white; if the dark `accent-strong` is lightened, add an `on-accent` token and use it for those labels (3 files) |
| charts (`matches-chart.tsx`) | already `rgb(var(--token))`-based; confirm visually |

## 5. Switch placement and route

- **Decision**: a compact three-button segmented control (`System`, `Light`, `Dark`, with sun/moon/monitor icons) in the sidebar foot beside the language menu, and the same component in Settings → General. It is a plain `<form method=post action=/settings/theme>` with a `back` field, like the language forms; no script.
- **Route**: `POST /settings/theme` in `routes/settings.tsx`: parse `theme` (`system|light|dark`), set or delete the cookie, `flashRedirect`-free redirect to `safeBack(form.back)`. Unknown value redirects back without change. Protected by the existing `originGuard()` (cross-origin POST refused), like every other POST.
- **Alternatives**: a `<select>` popover like the language menu (more clicks: SC-002 wants ≤2); a client-only toggle (flash, no persistence without script).

## 6. Pages outside Layout

`oidc/pages.ts` renders its own small document with the same `TOKENS_CSS` pieces; it reads the same `currentTheme()` so the sign-in page is not a light-only island. The printable/exportable surfaces (PDF render, CSV) do not use `Layout` and are untouched.

## 7. Testing

- `theme.test.ts`: `parseTheme` total (unknown → `system`), `themeAttr`, cookie header shape.
- `tokens.test.ts`: the existing AA matrix parameterised over `[LIGHT, DARK]`; a test that both records have identical keys; `rootBlock()` snapshot-ish assertions for the three selectors.
- `self-contained.test.ts` and `catalog.test.ts` keep passing (new keys in four catalogs; no third-party fetch).
- Route smoke: cross-origin POST to `/settings/theme` refused, same-origin sets the cookie, pseudo-language run unaffected.
- Manual: Playwright screenshots of Overview, Jobs, a job, Settings, Target (document pane) in both themes at 1280 and 390 px.
