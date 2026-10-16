# Research: One tailoring front door

## R1. What happens to hidden resumes and their dependants

- **Decision**: the migration runs `DELETE FROM "Resume" WHERE hidden = true` and then drops the column.
- **Rationale**: a hidden row only ever held a one-off upload. Matches, reviews and letters reference a resume through `onDelete: Cascade` in this schema (comparisons, reviews and letters are owned through the resume, ADR 0068), so one delete removes the dependants. The implementation task confirms every foreign key to `Resume` cascades, and adds explicit deletes in the migration for any that does not.
- **Alternatives**: keep the column and stop writing it (leaves `hidden` filters everywhere, contradicts "no hidden rows remain"); convert hidden rows to visible resumes (would flood Resumes with uploads the person never chose to keep).

## R2. Evidence marker

- **Decision**: new comparisons and letters always pass `evidence: 'own'`. `match-mode.ts:readMatchEvidence` still returns `'text'` for legacy rows, and `match-reuse.ts` keeps keying on it.
- **Rationale**: removes the only writer of `text` while keeping stored rows valid (FR-009). The `own` default in `cover-letter.ts` replaces the hidden-row inference.
- **Alternatives**: delete the `text` variant from the type (would break legacy reads).

## R3. Where the page-length control goes

- **Decision**: a `pages` select in the match card's Compare form (keep / 1 / 2 / 3), posted to `/jobs/:id/match`, which already parses `parsePageTarget(form.pages)` for a fresh Compare and takes the base comparison's marker for a re-check.
- **Rationale**: the pipeline already accepts it; only the form lacks the field. The option labels reuse the `target.pages.*` catalog keys (renamed only if the key prefix becomes misleading — kept to avoid churn in four catalogs).
- **Alternatives**: a separate settings default (not asked for).

## R4. `/letter` without new postings or files

- **Decision**: drop the `new` job mode, the URL/paste inputs, the upload and paste resume modes and the "own resume" tick-box. The run keeps `[match?] [verify?] letter`; the `fetch` and `extract` steps are unused by it and stay in `RunStep` only if another flow uses them.
- **Rationale**: matches the issue. `posting-url.ts` / `posting-extract.ts` may lose their only caller; `exports:audit` decides what is deleted. `checkPostingUrl`/`fetchPostingText` have other users (to be confirmed in tasks) — unused exports go with their callers.
- **Alternatives**: keep a "new posting" mode on `/letter` (contradicts "a posting at `/jobs/new` first").

## R5. Shared UI pieces

- **Decision**: `ModeCard` is used by `/screen/new` and `/letter`; `MineCheckbox` only by the launchers (deleted with them). `ModeCard` moves from `pages/target-start.tsx` into `ui.tsx` (or a small `pages/mode-card.tsx`) so the file can be deleted.
- **Rationale**: avoids leaving a launcher page file for one component.

## R6. The progress page keeps `/target/runs/:id`

- **Decision**: keep both routes and the `targetRoute` Hono instance for them; the "run gone" redirect and `target-runs.ts` default `backUrl` go to `/jobs`.
- **Rationale**: the issue says keep; welcome, jobs and letter flows redirect there.

## R7. Route policy and smoke

- **Decision**: remove `'GET /target'` and `'POST /target'` from `PERSONAL_ROUTES`; the route smoke fixtures that POST to `/target` or use scratch rows are updated.
- **Rationale**: the route smoke fails on an unlisted or stale route list.
