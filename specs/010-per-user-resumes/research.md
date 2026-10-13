# Research and decisions

## R1 - Which dependents get a `userId` column?
Decision: only the ones not reached through a resume: `Resume`, `CandidateFact`, `ApplicationPack`. `ResumeMatch`, `ResumeReview`, `CoverLetter` are owned through their resume (required FK, cascade).
Rationale: a second ownership column could disagree with the resume's; deleting a user cascades through the resume; one `where: { resume: { userId } }` is enough and uses the existing `resumeId` indexes.
Alternatives: denormalised `userId` everywhere (faster filters, drift risk, bigger migration).

## R2 - Posting brief and company verification
Decision: stay shared (keyed by job). Rationale: no resume or person in the prompt, a property of the posting, expensive (web search), and sharing is the point of a shared catalog. Readers still require the person to hold the posting. A consequence worth recording: a verification run by A is visible to B on that posting and shows A's evidence; it contains no private data, and `ApplicationPack.verificationId` / `CoverLetter.usedVerification` reference it by id.
Alternative: per-user verifications (duplicates paid web searches).

## R3 - Pack per (user, posting)
Decision: unique `(userId, jobId)`. The tick queues for every keeper without `skipsAlert` (the same rule that already decides alerts), each with its own fit and own daily counter; the runner prepares as the owner using their primary search, resume pick and `packJobState(owner, job)`.
Rationale: "make it per user" from the brief; a pack is the owner's tailored copy of their resume.
Settings (`AppSettings.pack`), the mute list and the "packs ready" message stay install-wide until #11.

## R4 - Store signatures
Decision: `userId` is an explicit first parameter of every store function that looks a row up by id or lists. Stores never read `currentUser()`.
Rationale: the worker has no request; the same function serves both; the compiler lists every caller.

## R5 - Foreign resume id on a search
Decision: the search save path treats a resume id that is not the person's as none (and the "Fill from resume" action 404s on it).
Rationale: `Profile.resumeId` is a plain nullable FK; ownership is the app's rule.

## R6 - Scratch (hidden) resume
Decision: one hidden row per person: `findFirst({ userId, hidden: true })`.

## R7 - Operator scripts
Decision: scripts keep addressing rows by id (the operator owns the install); they are not a request surface.
