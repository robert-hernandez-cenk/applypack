# Route contracts

| Route | Change |
|---|---|
| `POST /jobs/:id/consider` (new) | Form: `tab` (optional). Requires tracking on (else 303 back to the job). 404 if the person holds no row. Sets `pipelineStage='consider'` + ledger row in one transaction when it differs; never touches `status`/`appliedAt`. 303 to `jobHref(id, tab)`. |
| `POST /jobs/:id/stage` | `toStage` now accepts `consider`, `applying`, `expired`. Moving to `applied` sets `appliedAt = now` if empty. |
| `POST /jobs/:id/status` | `APPLIED` seeds `pipelineStage='applied'` when the stage is empty, `consider` or `applying`. |
| `POST /jobs/:id/application` | Stage select lists all stages (incl. the new ones); validation against `allStages`. |
| `GET /applications` | Columns: Consider, Applying, Applied, work…, No Offer (cards of rejected/ghosted/expired, a badge each), Unfiled panel only when stranded. |
| `GET /applications/export.{csv,md}` | Stage order follows `allStages`; labels in English. |

Browser contract (`public/board.mjs`): a drop target may carry `data-drop-group="<keys>"`; a card whose stage is in the group is not moved onto it.
