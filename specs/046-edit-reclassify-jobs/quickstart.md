# Quickstart: validating the edit

Prerequisites: a throwaway database (the route smoke inserts rows), `npm ci`, `npx prisma generate`.

## Automated

```bash
npm run lint:types && npm test          # includes job-edit.test.ts and the catalog test
npm run exports:audit
npm run build && npm run smoke:routes   # throwaway DB only
```

## Manual (dashboard on a scratch data folder)

`APPLYPACK_DATA_DIR=/tmp/ap WEB_PORT=4848 APPLYPACK_NO_OPEN=1 npm start`

1. Paste a short posting at `/jobs/new` (or import a one-line row) so you are its only holder.
2. Open `/jobs/<id>` → Details card → **Edit**. Change location to "Remote · Germany" and the description to 300+ characters; save. Expect: new text on the page, place chips follow, "Restore the original" appears, a score is formed (or the flash says why not).
3. Press **Restore the original**: the first text returns.
4. Clear the title and save: 400 page, typed values kept, message shown.
5. Save with no change: "nothing changed", no engine call in the log.
6. Mark the posting Applied, edit, save: status still Applied.
7. With a second user holding the same posting (or a board posting), open `/jobs/<id>/edit`: explanation, no form; a direct POST changes nothing.
8. Repeat 2 in the pseudo-language: no English outside the catalog.
