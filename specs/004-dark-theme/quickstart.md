# Quickstart: validating the dark theme

## Automated

```bash
npm run lint:types && npm test          # tokens (AA over both sets), theme, catalog, self-contained
npm run css                              # then confirm `git diff --stat src/web/public/tailwind.css` is committed
npm run exports:audit
```

Route smoke, throwaway database only (see `.github/workflows/test.yml`):

```bash
npm run build && npm run smoke:routes
```

## Manual (scratch data folder, never the live one)

```bash
APPLYPACK_DATA_DIR=/tmp/ap WEB_PORT=4848 APPLYPACK_NO_OPEN=1 npm start
```

1. Browser/OS set to dark, no `theme` cookie: open `/`, `/jobs`, a job, `/settings`, `/target` — all dark on first paint, no light flash (throttle CPU to make a flash visible).
2. Browser/OS set to light, no cookie: pages identical to before this change.
3. Choose **Dark** in the sidebar: page turns dark, stays dark on the next page and after a browser restart. Choose **Light** while the OS is dark: stays light. Choose **System**: cookie removed, OS decides, and flipping the OS setting updates an open page.
4. From another origin, `curl -X POST -H 'Origin: https://evil.example' -d theme=dark http://127.0.0.1:4848/settings/theme` is refused and sets no cookie.
5. In dark: open a resume/posting in the document pane — the page stays white inside a dark frame; status pills, the matches chart, buttons, inputs, popovers, tables and the toggle read clearly. Check at 1280 px and 390 px.
6. Switch the language to the pseudo-language or Spanish: the switch labels are translated.
7. Sign-in page (when OIDC or Basic Auth is on) follows the cookie.

## Run on 2026-10-12 (scratch data folder, port 4848)

| # | Result |
| --- | --- |
| 1 | Run: OS dark (emulated), no cookie — Welcome, Settings, Overview, Jobs, a job, Tailor resume all dark. The server renders no `data-theme`, so the media query paints the first frame; no flash by construction (not measured with a throttled CPU). |
| 2 | Run: OS light, no cookie — Settings at 1280 px and 390 px look as before. |
| 3 | Run: Dark pressed in the menu with the browser emulating light — page returns to the same URL, dark, cookie `theme=dark; HttpOnly; SameSite=Lax; Max-Age=31536000` (smoke). System removes the cookie (smoke). Not run: closing and reopening a real browser, and flipping the OS setting under an open page (CSS media query, not scripted). |
| 4 | Run in the route smoke: a cross-origin POST gets 403 and no `Set-Cookie`. |
| 5 | Run: 21 pages swept in dark for light-only backgrounds and dark-on-dark text — only the toggle's white knob (kept on purpose). Document pane is a white page in a dark frame. Phone width checked on a job page and Settings. |
| 6 | Pseudo-language smoke finds no untranslated theme text; the four catalogs carry the keys (`catalog.test.ts`). Spanish/French/Ukrainian not eyeballed. |
| 7 | Not run: OIDC and Basic Auth are not configured here. The sign-in page reads the same cookie (`oidc/pages.ts`); covered by typecheck only. |

Route smoke: 150 of 152 as expected. The two that failed are the pseudo-language pass over `/settings?tab=ai` and `/welcome?step=ai`, which flag the local Claude CLI's version string ("2.1.296 (Claude Code)"); CI has no CLI installed. Neither page touches the theme.
