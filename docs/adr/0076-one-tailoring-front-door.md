# 0076 — One tailoring front door

**Status:** Accepted (2026-10-16). Issue #55. Amends [0074](./0074-page-target-for-tailoring.md) (the page
target now sits on the match form), [0029](./0029-quick-check-and-lazy-suggestions.md) (the `evidence`
marker is no longer chosen by the caller) and TASKS R1 (the "own resume" box).

## Context

Two front doors led to the same pipeline and the same editor (`/jobs/:id/target`): the job view's
Resume match tab (a saved resume and a stored job, a save always possible) and the `/target` launcher
(a saved resume, an uploaded file or pasted text; a stored or pasted posting; a length target; no save
for a file or a paste). The launcher's one-off inputs needed a hidden scratch `Resume` row, an
`ephemeral` editor mode, special re-run logic that rebuilt the judged text from the earlier comparison,
and a second kind of evidence (`text`, with a tick-box to turn it into `own`). Every flow after it had
to ask "is this the scratch row?". The tailored-copy and condense work (#48, #49) assume one flow in
which a save is always possible and a length target is always present.

## Decision

- **The Resume match tab is the only front door.** Its Compare form gains the page-length select
  (keep / 1 / 2 / 3); the target rides in the stored comparison's `pages` marker as before.
- **`/target` is removed** — the page, its POST, the navigation entry, the `/target?job=` links and the
  "Compare a file or pasted text" hand-off. `/target/runs/:id` and its state route stay: they are the
  progress page every flow uses, and a gone run now sends the person to the jobs list.
- **The scratch resume is removed.** `Resume.hidden` is dropped; the migration deletes every hidden row
  (matches, reviews and letters cascade; a profile or an application that named one is unlinked), then
  drops the column. `upsertScratchResume`, `resolveResumeSource`, `ResumeSourceFields`, `ephemeral`,
  `oneOffDraft`, `earlierParams`, `comparedResumeName` and every "refused for a hidden row" branch go
  with it. A resume is added on the Resumes page, a posting at `/jobs/new`.
- **`/letter` takes a stored job and a saved resume.** The file, paste, new-posting and URL inputs go.
- **Evidence is always `own`.** Nothing writes the `text` marker. `readMatchEvidence` still reads it in a
  stored `breakdown` and the reuse memo still keys on it, so an old row stays valid and a new comparison
  never reuses it.

## Alternatives considered

- **Keep the launcher and remove only the length control from it.** Leaves the second door, the scratch
  row and the evidence choice in place; #48 and #49 would still have to branch on them.
- **Keep the scratch row for one-off checks but hide it better.** The cost was never the row's
  visibility; it was every consumer having to know about it.
- **Convert hidden rows into visible resumes on upgrade.** Would fill Resumes with uploads the person
  never chose to keep (the reason the row existed).

## Consequences

- A one-off check of a file or of text that is not in Resumes needs the file added first. That is the
  intended cost: the tailored copy (#48) and condense (#49) can rely on a save.
- Comparisons, cover letters and reviews made on a scratch resume before the upgrade are deleted with it.
- The `text` marker was only ever written on the scratch row, so after the upgrade no stored row carries it;
  `readMatchEvidence` keeps reading it as a guard for a database restored from before.
- `extractPostingFacts` loses the launcher as a caller (saved postings still use it); `fallbackTitle` is
  left with tests only.

## Non-goals

Tailored copies (#48), condensing (#49), Reactive Resume work (#50), and any change to the editor beyond
dropping its one-off mode.
