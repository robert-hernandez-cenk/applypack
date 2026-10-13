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
