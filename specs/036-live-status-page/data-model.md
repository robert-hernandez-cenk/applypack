# Data model

No change. The page reads one `cron_run` row: `id`, `name`, `status`, `startedAt`, `finishedAt`, `stats`, `errorMessage`, `progress`, `userId`. Visible when `userId IS NULL OR userId = current person`.

State: RUNNING -> (OK | FAILED | other terminal). The page shows the progress view in RUNNING and the outcome view in any other state; the transition is observed by `/runs/:id/card` answering empty.
