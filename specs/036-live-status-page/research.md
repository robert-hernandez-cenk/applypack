# Research

## Where "Live Status" lives
Decision: a RUNNING row's "What happened" cell shows only the link (a running row has `stats` null and no error). Rationale: matches the request, no other content to displace. Alternative: a new column, rejected by the request.

## One page, two views
Decision: `/runs/:id` renders the progress block while RUNNING and the shared outcome cell otherwise. Rationale: a bookmark or an open tab stays truthful. Alternative: redirect finished runs to `/runs`, rejected (loses the outcome sentence, spec FR-005).

## Refresh
Decision: reuse `public/running.mjs` with `url=/runs/:id/card`. The card answers an empty body once the row is not RUNNING; the module then calls `onGone` (reload) and the page renders the final view. Without script, `Layout`'s `refreshWithoutScript` reloads every 30 s while running. Alternative: new module, rejected as duplication.

## Shared outcome cell
Decision: move the cell body (error line + Details, `StatsCell`, "nothing scored" note) from `runs.tsx` into `pages/run-outcome.tsx` and use it in both pages. Rationale: FR-005 demands the same sentence; one copy cannot drift.

## Visibility and bad ids
Decision: reuse `visibleRuns()`; `parseRunId` accepts only `^[0-9]+$` within the int range; anything else, a missing row and a foreign row all give the same flash redirect to `/runs` (`runs.statusGone`). Route order: `/runs/running` and `/runs/fetch-now/...` are registered first so `:id` never shadows them.

## Policy
Decision: both routes in `PERSONAL_ROUTES` next to `GET /runs/running` (Run history is read-only for members).
