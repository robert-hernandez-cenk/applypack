# 0068 — A resume, and everything written with it, is its owner's

**Status:** Accepted (2026-10-13). Slice 4 of 6 of issue #5. Builds on
[0065](./0065-users-and-identity.md), [0066](./0066-searches-belong-to-a-person.md)
and [0067](./0067-a-person-holds-their-own-rows.md); amends
[0063](./0063-the-worker-prepares-an-application-pack.md) (a pack is per person).

## Context

With per-person searches and job rows, the resume side was still one pile:
anyone could open any resume, a comparison or letter of one person served as
the memo of another, confirmed facts were install-wide ("I know Azure" counted
for everybody), and the worker prepared every pack with the default user's
resume and only for the default user's matches.

## Decision

- **`Resume.userId`** (cascade; backfilled to user 1). Every list, picker,
  default flag, scratch row (`/target`, `/letter` keep one hidden row per
  person), duplicate check ("same text again") and lookup by id in
  `resume/store.ts` takes the `userId` first. A foreign id is a row that is not
  there: 404 on the pages, "no such resume" on a delete.
- **Owned through the resume, no column:** `ResumeMatch`, `ResumeReview`,
  `CoverLetter`. Their readers go `resume: { userId }`, so the memo, the
  history, the best score and the letters list can never cross people, and a
  deleted resume or user takes them along (the cascade already ran through the
  resume). A second ownership column would only have been a second answer.
- **`CandidateFact.userId`**, unique `(userId, term)`: what a person confirmed
  or denied about themselves is theirs.
- **`ApplicationPack.userId`**, unique `(userId, jobId)`: a pack is a person's
  tailored copy of *their* resume for a posting.
- **Stays shared, on purpose:** `PostingBrief` and `JobVerification`. The
  prompts hold no resume and no person; they are properties of the posting,
  one paid web search should serve everybody, and the readers that show them
  already require the person to hold the posting. `AiCall` keeps its bare
  `resumeId` (the ledger and the AI keys are install-wide until per-user keys).
- **Stores take the person; they never read `currentUser()`.** The dashboard
  passes `currentUser().id`, the worker passes the pack's owner. AI modules
  take the owner from the resume row they were given (`ResumeSummary.userId`).
- **Searches link only to their owner's resume.** The save path loads the
  resume through the scoped getter, so a foreign id is "resume gone";
  `listProfilesForResume` and the delete impact count only the owner's searches
  and applications.
- **Packs per person.** The tick, for a stored posting, asks `autoPack` for
  *every* person who keeps it (and whose alert is not skipped), from their own
  verdict, against their own day's count (`autoPacksToday(userId)`), and queues
  `(userId, jobId)`. A copy of a stored role is judged against that person's
  packs (`sameRole(userId, …)`). The runner claims the next row of anyone and
  prepares it as its owner: their primary search, their resumes (the pick among
  the owner's only), their job state. A person's pack is visible only to them.
- Migration `20261013100000_user_resumes`: three columns defaulting to 1, two
  unique indexes swapped.

## Consequences

- The **pack settings** (`AppSettings.pack`), the **mute list**, the cover-angle
  settings and the "packs ready" message are still install-wide; they are #11.
  A person's pack therefore follows the install's switch, floor and limit
  *numbers*, but the limit is counted per person.
- Deleting an import or a company takes every person's comparisons, letters and
  packs with the postings; the confirm dialogs count them install-wide, as they
  already did for applications.
- Operator scripts (`scripts/*`) address rows by id and may read any person's
  resume: they are the installer's tools, not a request surface.
- Run ids on `/target/runs/<uuid>` are random and in memory; the progress page
  does not check the owner. They only name work the person started themselves.
- Employer mode (Screening) is unchanged.

## Alternatives considered

- **`userId` on every dependent (match, review, letter):** faster filters,
  but two columns that can disagree and a bigger migration; the `resumeId`
  index already makes the join cheap.
- **Per-user verification and brief:** pays the web search again for every
  person who holds a posting; nothing private is in them.
- **One pack per posting, prepared for "the winner":** picks one person's
  resume for everyone, the exact thing this slice removes.
