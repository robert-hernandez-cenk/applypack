# Quickstart: validating keyword edits that keep your place

Prerequisites: a build and a scratch install (see CLAUDE.md "Test the launcher on a scratch folder"), one stored job
with a saved resume and a finished comparison that has 15+ keywords. Never use the live data folder.

## Automated

```bash
DATABASE_URL=postgresql://ci:ci@localhost:5432/ci ANTHROPIC_API_KEY=sk-ci-dummy npm test
npm run lint:types
npm run exports:audit
npm run i18n:browser   # then git diff --exit-code src/web/public/i18n-en.mjs
```

The route smoke (`npm run smoke:routes`, throwaway database) renders both pages, so the new markup and the
pseudo-language pass are exercised.

## In a browser (desktop 1280 and phone 390 wide)

1. Open `/jobs/:id/target?match=:m`. Scroll the keyword list so its middle shows. Note `scrollY`.
2. Change a keyword's level with the mouse, then with the keyboard (arrow, Enter): row, message and score update;
   `scrollY` unchanged; focus still on the select.
3. Press Ignore, then Restore, Reset, Remove (on an added word): same.
4. Add a word, then the same word again: the first adds it, the second shows the refusal; no scroll.
5. Type into the resume text first, then repeat 2: the text, the unsaved bar and the cursor survive; the ring, the
   highlights and the missing chips match the new levels.
6. Repeat 2–4 on `/jobs/:id?match=:m#resume-match` (Resume match tab).
7. Stop the server, edit a keyword: an error line appears and the controls work again.
8. Disable JavaScript, edit a keyword: normal post, reload, message.
