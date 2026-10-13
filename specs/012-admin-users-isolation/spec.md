# Feature Specification: Admin role, users page and isolation tests (issue #12, slice 6 of 6 of #5)

**Status**: Draft
**Input**: Issue #12. Shared job catalog, private per-user workspace (ADR 0065-0069). Slices 1-5 made every personal table owned; what runs the install is still editable by any signed-in person, and nobody can see or manage the users. This slice puts the role to work, adds the users page and proves the isolation.

## User Scenarios & Testing

### User Story 1 - Only an administrator runs the install (Priority: P1)
Everything that runs the install for all — sources and companies, discovery, the fetch schedule, pause and "Fetch now", the AI engine, keys, budget and usage, source keys, classifier mode, update check, employer mode and its screenings, imports and watched folders, starter packs, the first-run wizard — is open to administrators only. A member who types such a link or posts such a form is refused with a 403 page in their language, and nothing changes. The menu shows a member only what they can use.

**Why this priority**: today any signed-in person can change the AI key, delete a source or pause fetching for everybody.

**Independent Test**: with a member session, every admin route answers 403 and leaves the database as it was; with an administrator session the same requests behave as before.

**Acceptance Scenarios**:
1. **Given** a member, **When** they post `/settings/ai/key`, `/companies/:id/delete` or `/runs/fetch-now`, **Then** the answer is 403 and nothing is stored or started.
2. **Given** a member, **When** they open `/settings`, **Then** the page shows personal tabs and sections only; install-wide sections are absent and the fetch half of the schedule stays read-only.
3. **Given** a member, **Then** the menu has no Discovery, AI usage or Screening entries, and Companies shows only their muted-companies list.
4. **Given** a member, **When** they open `/runs`, **Then** they read the install's runs, the install's search funnel and their own recaps, with no "Fetch now" or pause control.
5. **Given** an installation without sign-in, **Then** the one implicit user is an administrator and nothing is refused.
6. **Given** a new member signs in on an install whose wizard is not finished, **Then** they land on their overview, never on `/welcome`, and `/welcome` is refused.

### User Story 2 - An administrator sees and manages users (Priority: P1)
A users page (administrators only) lists every user: name, role, when they joined and when they were last active. An administrator can make a member an administrator, make an administrator a member, or remove a user. Removing shows what goes with them (searches, held postings, resumes, destinations) and asks for confirmation. The install can never be left without an administrator, and nobody locks themselves out through this page.

**Independent Test**: unit tests of the rules; route checks with two administrators and one member.

**Acceptance Scenarios**:
1. **Given** two administrators, **When** one demotes the other, **Then** the role changes.
2. **Given** the only administrator, **When** they try to demote or remove themselves, **Then** it is refused with a reason.
3. **Given** an administrator, **When** they try to demote or remove themselves while another administrator exists, **Then** it is refused too (another administrator does it): nobody locks themselves out by a misclick.
4. **Given** a member with data, **When** an administrator removes them, **Then** the confirm lists the counts, and after confirming the user and everything of theirs are gone (the shared catalog is untouched).
5. **Given** a removed user's session cookie, **Then** their next request is a 401 and they sign in again as a new member.
6. **Given** a member, **When** they open the users page or post to it, **Then** 403.

### User Story 3 - Proof that people cannot see each other (Priority: P1)
The route smoke classifies every registered route as administrators-only or personal, fails on an unclassified one, and runs a sweep with a member session: administrator routes refuse; personal routes never show another person's rows; a foreign id reads as not found.

**Acceptance Scenarios**:
1. **Given** a new route that is in neither list, **Then** the build fails until it is classified.
2. **Given** a member and an administrator each with their own resume, job state, target and run, **When** the member requests the other's ids on every route that takes one, **Then** each answers not found (or 403 for admin routes) and no foreign text appears.

### User Story 4 - Loose ends from slices 3-5 are closed (Priority: P2)
A search cannot be linked to a resume of another person even if a route forgets to check; a tailoring run's progress and result pages are visible only to the person who started it; the per-person pack queueing decision is covered by a test.

### User Story 5 - Operators can set it up from the docs (Priority: P2)
README and the operator docs explain multi-user setup with OIDC, the first-user-is-admin rule, roles and what a member cannot do. SPEC and PRODUCT no longer say "one user". CHANGELOG and version are prepared.

## Requirements
- **FR-001** A pure policy classifies a method and path as admin-only or personal; a list of personal routes and a list of admin routes together cover every registered route (checked in the route smoke).
- **FR-002** A middleware after the current-user step refuses an admin-only request from a member with a 403 page (localized message), before any handler or body parsing runs.
- **FR-003** The menu, the Overview and the settings page draw admin-only entries and sections only for administrators. The settings tabs split into personal and install-wide; a member opening an install-wide tab is shown a personal one.
- **FR-004** `GET /companies` for a member shows only their muted companies; mute and unmute routes stay personal. `/runs` GET and the fetch progress pages are readable by members (read-only, no controls), starting a run is admin-only.
- **FR-005** The wizard is never offered to a member: `/` does not redirect them, the Overview does not link it, `/welcome` is admin-only.
- **FR-006** A users page lists users with role, joined, last active, and counts; role change and removal are administrator posts.
- **FR-007** Pure rules decide a role change or removal: the last administrator can be neither demoted nor removed; nobody demotes or removes themselves; an unknown user is not found. The store re-checks the rule inside a transaction so two administrators acting at once cannot remove the last one.
- **FR-008** Removing a user deletes their rows by the existing cascades and reports counts first (searches, held postings, resumes, comparisons and letters, destinations). A user who is mid-session gets a 401 on the next request.
- **FR-009** `createProfile` and `updateProfile` accept a resume only when it belongs to the profile's owner (store-level guard).
- **FR-010** `/target/runs/:id` and its state answer not found unless the run was started by the current user.
- **FR-011** The route smoke runs the member sweep described in User Story 3; unit tests cover the policy and the rules.
- **FR-012** Every new string is a catalog key present in every language; docs, ADR 0070, CHANGELOG and version updated.

## Success Criteria
- **SC-001** A member cannot change any install-wide state through any route (sweep passes).
- **SC-002** An install can never be left without an administrator through the dashboard (tests, including the concurrent case).
- **SC-003** An install without sign-in behaves exactly as before (smoke runs as the implicit administrator).
- **SC-004** The sweep fails when a route is added without being classified.

## Assumptions
- "Last activity" is the newest of the user's resume save, settings save, stage change or application; a user who never did anything shows "never" (no write per page view).
- The funnel on `/runs` is install-wide (the catalog's counters) and is shown read-only to members; their own source yield stays theirs.
- Role names stay `ADMIN` and `MEMBER`; there is no invitation or approval step: anyone the identity provider lets in becomes a member (restrict at the provider, ADR 0064).
- Removing a user is permanent; a returning person signing in again becomes a new member.
- The Screening module stays unscoped: administrators only, one shared set.

## Non-goals
Per-user AI keys; employer-mode scoping; invitations, email, approval queues; per-user wizard; role beyond two; moving people's data between users.
