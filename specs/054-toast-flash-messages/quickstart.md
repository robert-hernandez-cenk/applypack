# Quickstart: validating result messages as toasts

Prerequisites: the worktree with `npm install` done; a scratch install (`APPLYPACK_DATA_DIR=/tmp/ap WEB_PORT=4848 APPLYPACK_NO_OPEN=1 npm start`) —
never the live data folder. For the route smoke, a throwaway Postgres only (see `.github/workflows/test.yml`).

1. **Checks**: `npm run lint:types`, `npm test`, `npm run exports:audit`, `npm run i18n:browser` leaves no diff.
2. **Pure decisions**: `src/web/toast.test.ts` — `ok` short → ~4 s, long → capped 12 s; `warn`, `err`, an action → sticky.
3. **Route smoke**: `npm run build && npm run smoke:routes` — every page 200, the pseudo-language run leaves no English,
   an error flash renders `role="alert"`, a message with an action renders `data-sticky`.
4. **Browser, desktop (1280×800), light then dark**: open a job's Resume match tab with a long keyword list, scroll to the
   bottom, change a keyword level → the message appears bottom-right, nothing on the page moves, it leaves by itself
   in about 4–12 s; hover it → it stays until the pointer leaves.
5. **Browser, phone (390×844)**: same; the message spans the width with 16 px gutters and covers no header button.
6. **Sticky cases**: cause an error (e.g. save an empty required field) → stays 60 s, red tone, `role="alert"`, field marked
   invalid and described by it; close with the button, then with Escape on another. A "Re-run anyway" message → stays; the
   button works.
7. **No script**: disable JavaScript → the same actions show the top banner and the page works.
8. **Reduced motion** (DevTools rendering emulation): no slide/fade.
9. **Screen reader spot check**: a success is spoken once; an error is spoken once and interrupts.
