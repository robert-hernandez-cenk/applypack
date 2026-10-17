# Research: Consider, Applying, Expired and No Offer

All findings come from reading the code at `origin/main` (4121730).

## R1 — Where "has any stage" is read as "has applied"

- `src/pack/store.ts:53` (`appliedTo`, a Prisma `where`) and `:223` (`packJobState.applied`): a ready pack of an applied job is kept as sent. **Convert** (a Consider job must not freeze its pack).
- `src/web/applied-resume.ts:112` (`needsAppliedResume`): asks "which resume did you send?". **Convert.**
- `src/web/routes/companies.tsx:126`, `src/web/routes/jobs-import.tsx:86`: "applications" counted in the delete confirm. **Convert** (a Consider posting is not an application).
- `src/jobs/stale-applications-job.ts:40`: filters `pipelineStage: 'applied'` already. **No change**, covered by a test of the rule.
- `src/jobs/cleanup-job.ts:35` and `src/jobs/france-travail-sync.ts:100`: a non-null stage means "the person's own work, keep it". That is ownership, not "applied", and the spec says to keep protecting. **No change**; `planSync` gets a Consider/Applying test.
- Overview stats (`overview-stats.ts`, `overview-numbers.ts`) read `status`/`appliedAt`, not the stage. **No change** (verified by grep).

## R2 — Mark applied seeds the stage only when it is empty

`routes/jobs.tsx:640` does `if (current && !current.pipelineStage)`. A Consider/Applying job would keep its old stage while `status=APPLIED`, so the board would not show it as Applied. **Decision**: seed `applied` when the stage is empty or in `PRE_APPLY_KEYS`; leave a later stage (a work column, an end state) alone, as today.

## R3 — appliedAt

The board quick-move (`routes/applications.tsx`) writes the stage only. Dragging a Consider card to Applied would leave no apply date, so the card would be "Applied" with `appliedAt` null. **Decision**: the quick-move sets `appliedAt = now` when the target is `applied` and it is empty. Never cleared on a move back.

## R4 — Time line for pre-apply stages

`stageTimeLine` falls back to "applied Nd ago" from `appliedAt` when a stage has no ledger event. For `consider`/`applying` that is wrong. **Decision**: for `PRE_APPLY_KEYS` the fallback is skipped; the line is the ledger event's "in Consider N days" or nothing, with no stale warning without an event, and the card does not print "No apply date" (that text is for Applied-and-later cards).

## R5 — No Offer is a group, not a stage

A `no-offer` stage value would need data migration and would lose the specific state. **Decision**: `no-offer` is a presentation column holding the cards whose stage is in `END_STAGES`; each card carries its own `data-stage`. The column is the drop target for `rejected` (default) and declares its group (`data-drop-group="rejected ghosted expired"`) so `board.mjs` ignores a drop from inside the group. The key `no-offer` is reserved so a work column cannot collide with its element ids.

## R6 — Old "Closed" panel

The `<details id="closed">` is replaced. Unfiled (stage keys no column covers) is an exception, not a funnel step; it keeps a small `<details id="unfiled">` below the board so those jobs stay reachable. Mobile nav chips: "Closed" becomes "No Offer", plus Unfiled when present. The header meta line keeps its two numbers; "closed" becomes "no offer".

## R7 — Collapse module

`public/` modules are ES modules without a build; pure functions are tested through `import()` (see `board.test.ts`). `column-collapse.mjs` exports `readCollapsed(storage, key)`, `writeCollapsed(storage, key, value)` (both swallow storage errors), `toggled(collapsed)` and `initCollapse(doc, storage)`. The button is a real `<button aria-expanded aria-controls>` (`accessible-interactions`), hidden below `md`. The collapsed look is CSS keyed to `[data-collapsed="true"]` inside the `min-width: 768px` media block of `BOARD_CSS`, so mobile is unaffected. A drag over a collapsed rail expands it without saving.

## R8 — i18n

New catalog keys (en/es/fr/uk): `stages.consider`, `stages.applying`, `stages.expired`, `stages.noOffer`, column and toggle labels, `job.consider`, flash text, `applications.line.*` additions, reworded `settings.appliedAndTheTwoClosed` and `settingsRoute.stages.lastColumn`. Browser keys (`browser.*`) come from `npm run i18n:browser`. The route smoke's pseudo-language pass fails on any English left outside the catalog.

## R9 — ADR

ADR 0025 made Applied/Rejected/Ghosted the fixed ends. ADR 0080 amends it (fixed start: Consider, Applying, Applied; fixed ends: Rejected, Ghosted, Expired, grouped as No Offer) and records the `hasApplied` rule.
