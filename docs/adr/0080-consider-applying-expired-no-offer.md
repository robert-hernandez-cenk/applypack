# 0080 — Consider and Applying before Applied; Expired and one No Offer column after

**Status:** Accepted (2026-10-17). Issue #52. Amends [0025](./0025-custom-work-stages.md) (the fixed entry and
exits) and [0024](./0024-append-only-stage-ledger.md) only in that the ledger now records the new stages like any other.

## Context

ADR 0025 fixed one entry (`applied`) and two exits (`rejected`, `ghosted`) and left the columns between to the
person. That assumed applying is instant: a posting enters the board when it is sent. In practice applying takes
work (tailor the resume, write a letter, fill the form) and there was nowhere to park a posting meanwhile. The
exits were also split: Rejected and Ghosted lived in a "Closed" panel under the board, and a posting that simply
went away had no state.

The second problem is a reading one. Several readers took "holds a stage" to mean "has applied": the pack's
"kept as sent" rule (`pack/store.ts`), the "which resume did you send?" prompt (`applied-resume.ts`). A posting
parked before applying would have been misread as an application by each.

## Decision

- **Three fixed stages open the board**: `consider` ("I might apply"), `applying` (in progress, not sent),
  `applied` (sent; as before). **Three fixed end states close it**: `rejected`, `ghosted`, and the new `expired`
  (the posting closed or went stale), set by hand. Stages stay strings in `UserJob.pipelineStage`: no enum, no
  migration, no change to a stored row. The person's work columns between Applied and the end are untouched.
  `consider`, `applying`, `expired` and `no-offer` join the reserved keys.
- **No Offer is a column, not a stage.** The last column groups the three end states; no card holds `no-offer`.
  Each card keeps its own state and shows it as a badge, so the history stays specific. A card dropped on the
  column becomes **Rejected**; a card already in an end state stays as it is (`data-drop-group`); the specific
  state is chosen with the quick-move select or the stage field on the job page. Cards whose stage no column
  covers (a removed work column) keep a small "Unfiled" panel of their own, as they were not a funnel step.
- **One rule says "applied"**: `src/applied-state.ts:hasApplied` — the inbox status is Applied, or there is an
  apply date, or the stage is anything but `consider`/`applying`. `appliedWhere` is the same rule as a Prisma
  filter. The pack store and `needsAppliedResume` go through it. The stale-applications digest already asked for
  `applied` only. An apply date wins over a pre-apply stage (a card moved back from Applied was applied).
- **The apply date belongs to Applied.** A board move into `applied` sets it if empty; Mark applied sets it if
  empty and moves the stage to `applied` from no stage, Consider or Applying (a later stage stays where the
  person put it). No other move sets or clears it.
- **Entry to Consider is a button** on the job page, left of Mark applied, posting to `POST /jobs/:id/consider`.
  Saved stays an inbox state and never enters Consider by itself. Any stage can move to any stage.
- **Not converted, on purpose**: the cleanup job and the France Travail sync keep protecting any held stage
  (ownership, not "applied"); the counts shown before deleting a company or a source keep counting Consider and
  Applying cards, because a delete removes them too.
- **The collapse is a per-viewer convenience**: `public/column-collapse.mjs` folds the column to a rail on md+,
  remembers it in `localStorage` (guarded; blocked storage means "open"), and is a real button with
  `aria-expanded`. A phone sees no toggle.

## Alternatives considered

- **`no-offer` as a stored stage** that the three end states become sub-states of: needs a data migration, loses
  the specific state in the ledger, and every reader would parse a pair.
- **Changing the apply rule to "stage = applied or later by position"**: the person's columns are data and their
  order changes, so position says nothing durable. A fixed deny-list of the two pre-apply keys does.
- **Entering Consider from Saved automatically**: mixes an inbox state with a board state; the person chose a
  button instead.
- **Converting the delete-impact counts too**: would hide cards a delete destroys.

## Consequences

✅ A posting can be held, worked on and moved on without pretending it was sent.
✅ Every end state is visible in one place, and Expired has a home; nothing stored changes.
✅ The "applied" question has one answer and one test.
❌ "Closed" is gone as a word on the board; bookmarks to `#closed` land at the top.
❌ A new reader of `pipelineStage` must ask `applied-state.ts`, not test for non-null; the two ownership readers
are the exceptions, and each says so where it is written.

## When to revisit

Expiry from a posting's liveness (the follow-up issue), or a request for a fourth fixed stage.
