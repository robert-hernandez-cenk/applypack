# Route contracts

| Route | Answer |
|-------|--------|
| `GET /runs/:id` | 200 HTML status page (progress view if RUNNING, outcome view otherwise). Non-numeric, missing or foreign id: 303 to `/runs` with an error flash. |
| `GET /runs/:id/card` | RUNNING: 200 HTML fragment (the progress block), `Cache-Control: no-store`. Not RUNNING, missing, foreign or non-numeric: 200 empty body (the poller treats it as "over"). |
| Run history row | RUNNING rows: `<a href="/runs/{id}">Live Status</a>` in the "What happened" cell. Other rows: no link. |

Both routes: personal (members allowed), GET only, no state change.
