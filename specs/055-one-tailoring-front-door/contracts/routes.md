# Route contract: One tailoring front door

| Route | Before | After |
|-------|--------|-------|
| `GET /target` | launcher page (`?job=` preselects) | not found |
| `POST /target` | start a comparison from job/resume/file/paste | not found |
| `GET /target/runs/:id` | progress page | unchanged; a gone run redirects to `/jobs` with the "run gone" flash |
| `GET /target/runs/:id/state` | progress JSON | unchanged |
| `POST /jobs/:id/match` | form: `resumeId`, `mode`, optional `draftText`, `matchId`, `next`, `rebuild`, `force`, `pages` | same fields; the Compare form now sends `pages` (`keep`/`1`/`2`/`3`); resume must be a visible resume of the caller; evidence always own |
| `POST /jobs/:id/target/reupload` | new file for the same target | unchanged apart from dropping the hidden-row branches |
| `GET /jobs/:id/target` | editor; `ephemeral` for a scratch resume | editor; Save as vN always offered |
| `GET /letter` | launcher: job (stored/new), resume (saved/upload/paste) | job picker + saved-resume select + tone/angles + optional steps |
| `POST /letter` | fields incl. `jobMode`, `jobUrl`, `description`, `companyName`, `title`, `resumeMode`, `resumeText`, `uploadName`, `pasteName`, `mine`, file | `jobId`, `resumeId`, `tone`, angles, `runMatch`, `runVerify` |

Access policy (`src/users/admin-policy.ts`): `GET /target` and `POST /target` leave `PERSONAL_ROUTES`; every other entry stays.
