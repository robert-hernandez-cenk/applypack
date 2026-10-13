# Research: Admin role, users page and isolation tests (#12)

**R1 - Where does the role check live? Decision**: one pure route-access table plus one middleware, not a guard line in 70 handlers. Rationale: a new route that nobody classified fails closed and fails the smoke; the handlers stay unchanged. Alternatives: per-route `requireAdmin` middleware (easy to forget, no way to enumerate), a Hono sub-app per role (reorders the mount order that `/jobs/import` and `/companies/folder` depend on).

**R2 - Mixed pages. Decision**: pages adapt to the role (`isAdmin` prop); only writes are refused by the middleware. `/companies` GET for a member shows the mute list only, because the mutes live there (ADR 0056) and are personal. `/runs` GET stays readable: it lists install runs and the person's own recaps already (ADR 0069); the funnel (`funnel_day`) is the catalog's counters, not anyone's private data, so it stays readable; the person's source yield was already per user. This closes the "decide and record" item from #11.

**R3 - Last activity. Decision**: newest of `UserJob.updatedAt`-style column (checked in schema when implementing), `JobStageEvent` time and the user's own `CronRun.startedAt`; null shows "never". No new column or write on each request (cheaper, no write amplification). Alternative `lastSeenAt` on every request rejected: a write per page view.

**R4 - Self-protection. Decision**: nobody demotes or removes themselves, even with another admin present. Rationale: simplest rule that cannot lock out; another admin does it. The last-admin rule is still separate because an admin can be the only one and a second admin could be removed concurrently. Concurrency: re-check in a transaction under the repo's global write lock.

**R5 - Pack queueing test. Decision**: `pack/trigger.ts` is pure and takes the person's settings; add a unit test with two people (one on, one off). The DB path (queue row per owner) is not mocked; the sweep creates a member and asserts a member's `POST /jobs/:id/pack` cannot touch the other's pack (404). Alternative: injected-store integration test; skipped - no seam exists in `pack-job`/`process-jobs` without a refactor out of scope here.

**R6 - Wizard for members. Decision**: members are never redirected; `/welcome*` is admin-only (GET redirects a member to `/`). The wizard sets install-wide engines and sources. The language "setup not completed" branch treats a member as completed.

**R7 - Removing a user. Decision**: `prisma.user.delete`; cascades exist on every owned table (`Profile`, `UserJob`, `Resume`, targets, mutes, settings, packs, facts, stage events). `CronRun.userId` has no FK (nullable int): their per-person runs are deleted in the same transaction. `User.primaryProfileId` is SetNull on the user side; profiles cascade by `userId`. Confirm text counts searches, held postings, resumes, destinations.

**R8 - The 403 page**. Decision: render with `Layout` (so the member keeps the menu) and a catalog message; JSON `{error}` for `/state` polls. Status 403, not 404, so a member learns the page exists but is not theirs.

**R9 - Version**: runtime feature, so a minor: 2.57.0 (the integration branch is at 2.56.0 from #2; slices 7-11 did not bump). No tag; the final integration PR does it.
