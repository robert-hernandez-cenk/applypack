# Route contracts

All are personal routes under `/jobs/:id/matches/:matchId/condense/…` (POST, form body), owner-checked through `getMatch(currentUser().id, …)`; a match of another job or person is "not found". Each starts or joins a run and answers `303` to `/target/runs/:runId`, which returns to `/jobs/:id/target?match=:matchId`.

| Route | Form | Behaviour |
| --- | --- | --- |
| `POST …/condense/cuts` | none | Phase A on `match.resumeText`. Replaces `removals`, clears `condense`, sets marker `removals`. |
| `POST …/condense/words` | `text` (editor text, required, non-empty) | Refused with a flash if marker is absent (Phase A not run). Phase B on `text`. Stores `condense = { rewrites, from: text }`, sets marker `rewrites`. |
| `POST …/condense/refresh` | `text` (optional) | The suggestions call over `text` (or the row's text) keeping `removals`. Refused with a flash if the comparison is a quick check. |

Guards: `onceGuard`-style double-press protection through `claimRun` keys `condense-cuts:<id>`, `condense-words:<id>`, `suggestions:<id>`.
