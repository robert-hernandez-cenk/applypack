# Feature Specification: Per-user profiles, searches and scoring (issue #8, slice 2 of 6 of #5)

**Status**: Draft
**Input**: Issue #8. Shared job catalog, private per-user workspace (ADR 0065). This slice makes searches ("profiles") belong to a user and the primary search belong to a user; scoring still happens once per posting against every running search of every user.

## User Scenarios & Testing

### User Story 1 - Each person has their own searches (Priority: P1)
A person signed in to a shared install sees, creates, edits, switches on/off, makes primary and deletes only their own searches. Another person's searches are neither listed nor reachable by id.

**Why this priority**: it is the point of the slice; every other private thing hangs off a person owning their searches.

**Independent Test**: two users each with searches; every listing and every change by one never shows or touches the other's; a foreign search id behaves as "search gone".

**Acceptance Scenarios**:
1. **Given** users A and B with searches, **When** A opens Settings, **Then** only A's searches appear and A's primary is the one preselected.
2. **Given** a search owned by B, **When** A posts an edit, switch, make-primary or delete for its id, **Then** nothing changes and A gets the "search no longer exists" message.
3. **Given** A has the maximum number of running searches, **When** B switches one on, **Then** it succeeds (the limit is per person).
4. **Given** a person's primary search, **When** they try to switch it off or delete it, **Then** it is refused as today.

### User Story 2 - Existing installs keep working untouched (Priority: P1)
An install upgrading from before this slice (one implicit user) finds every search still there, owned by the default user, with the same primary and the same running searches.

**Acceptance Scenarios**:
1. **Given** a database with searches and a primary in the old settings, **When** the migration runs, **Then** all searches belong to the default user and that user's primary is the old primary.
2. **Given** an install without sign-in, **When** the dashboard is used, **Then** behaviour is identical to before.

### User Story 3 - A new member starts with a search (Priority: P2)
The first time someone signs in who is not the default user, they get a blank primary search of their own, so the dashboard has the defaults every page falls back to.

**Acceptance Scenarios**:
1. **Given** OIDC sign-in by a new person, **When** their user is created, **Then** they own one blank, running, primary search.
2. **Given** the first person to sign in (taking over the default user), **Then** they keep the existing searches and no extra search is created.

### User Story 4 - Scoring covers everyone, views show only mine (Priority: P1)
One scoring call per posting still scores against every running search of every user (the catalog is shared, a search is one call, not one call per user). Each verdict is stored against its search. A person's job list, search chips, score filter and a job's score row show only their own searches' verdicts.

**Acceptance Scenarios**:
1. **Given** running searches of users A and B, **When** a fetch tick scores a posting, **Then** verdicts are stored for each search and alerts are gated by each search's own threshold.
2. **Given** a posting scored by both, **When** A opens it, **Then** only A's searches appear in the score row; the `?profile=` filter accepts only A's searches.
3. **Given** reclassify or "score unscored" started by a person, **Then** the ranking search is that person's primary.

### Edge Cases
- A user whose primary is deleted indirectly (cascade) ends with no primary: pages must cope as they do for a fresh install.
- A search id from a form that belongs to nobody (deleted) reads as "search gone".
- The best-of fit score on a job (`Job.fitScore`) is still computed across all users' searches; making it personal is slice 3.

## Requirements

- **FR1**: every search belongs to exactly one user; existing searches belong to the default user.
- **FR2**: a user's primary search is stored on the user, not in the install-wide settings; the migration moves the old value to the default user and removes the settings column.
- **FR3**: the running-search limit applies per user.
- **FR4**: all search reads and writes from the dashboard are scoped to the signed-in user; a foreign id is indistinguishable from a deleted one.
- **FR5**: fetch, import, HN, reclassify and classify-existing score against every running search of every user in one call per posting.
- **FR6**: jobs list, chips, `?profile=` filter and the job page's score row show only the current user's searches.
- **FR7**: worker and script callers that need "a primary" take a user id; callers not yet scoped pass the default user.
- **FR8**: a newly created OIDC member gets a blank, running, primary search.
- **FR9**: the install bootstrap creates its first search for the default user.
- **FR10**: ADR 0066 and the docs (SPEC, ARCHITECTURE, where-to-look, CLAUDE.md) describe the change.

## Success Criteria
- **SC1**: two users never see or change each other's searches (covered by tests on the scoping rules).
- **SC2**: the migration applies to an existing database and `prisma migrate diff` is empty afterwards.
- **SC3**: an install without sign-in behaves exactly as before; the route smoke passes.
- **SC4**: scoring cost per posting does not grow with the number of users beyond the prompt carrying more searches (still one call).

## Assumptions
- Job state (status, notes), resumes, notification routing and personal settings stay install-wide until slices 3, 4 and 5; a search's alert target is untouched here.
- The running-search limit stays 8 per user; the classifier prompt grows with the total running searches across users.
- The pack runner and scripts use the default user's primary until resumes are scoped (slice 4).

## Non-goals
Per-user job state, resumes, notification routing, personal settings, admin UI, per-user AI keys, employer mode.
