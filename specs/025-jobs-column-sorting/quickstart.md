# Quickstart: verifying sortable columns

Run from the worktree `C:\Users\rcher\Dev\applypack-Worktrees\issue-25-jobs-column-sorting`.

## Automated

```bash
npm run lint:types
npm test
npm run exports:audit
```

Expect `src/web/job-sort.test.ts` to cover: parse (every old value, garbage → default), `nextSort` (default direction, reversal), `ariaSort`, and `sortOrderBy` (null placement, id tie-break, employer-then-company).

## In the browser (scratch data folder, never the live one)

```bash
APPLYPACK_DATA_DIR=/tmp/ap WEB_PORT=4848 APPLYPACK_NO_OPEN=1 npm start
```

With a few postings loaded, at 1280 px and at 390 px:

1. `/jobs`: click **Fit** → highest first, arrow down on Fit; click again → lowest first.
2. Click **Title** → A→Z; **Salary** → rows without salary last in both directions.
3. Apply a status tab and a place filter, go to page 2, click a header → filters kept, page 1.
4. Open `/jobs?sort=postedAt_desc` and `/jobs?sort=nonsense` → no header marked (first), default order (second).
5. Tab to a header link: visible focus; Enter sorts. Inspect the sorted `th`: `aria-sort` set; others none.
6. Switch the interface language (es, fr, uk): the link titles are translated.
