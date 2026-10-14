# Contract: `GET /runs/running`

Personal route (listed in `PERSONAL_ROUTES`), same access as `GET /runs`.

**Response 200** `text/html` — an HTML fragment (no `<html>`, no layout):

- When at least one visible run is `RUNNING`: the "Running now" card root, `<section id="running-now" data-ui="running-now">`, one block per run, ordered by `startedAt` ascending.
- When none: an empty body (zero bytes). The page's module reads this as "stop polling" and removes the card.

Visible runs: `status = RUNNING` and (`userId IS NULL` or `userId = currentUser().id`).

**Block contents** (all words from the catalog, in the reader's language): job name (`translate="no"`), stage label, progress bar with `done / total` when `total` is known, elapsed, counters, ETA or "no estimate" (only when a total is unknown; hidden below 20 items), "last update N s/min ago" — amber when older than 120 s. A run with no progress shows name and elapsed only.

**Bar accessibility**: `role="progressbar"` with `aria-valuenow/min/max` when a total is known; indeterminate otherwise (no `aria-valuenow`).

**Caching**: `Cache-Control: no-store`.

**Errors**: a database failure is a 500 as for any route; the module keeps the old card and retries on the next tick.

## Browser module `public/running.mjs`

`init(root, { url = '/runs/running', everyMs = 5000, fetchImpl = fetch })`

- every `everyMs` while the document is visible: `fetchImpl(url)`; on 200 replace `root.outerHTML`/children with the body; on an empty body remove the card and stop; on any failure keep the card and try again.
- pure helper `nextState(prevHtml, body)` → `'swap' | 'remove' | 'keep'`, tested.
- no script: `<noscript>` reload via `Layout refreshWithoutScript` set by the page only while a run is in the list.
