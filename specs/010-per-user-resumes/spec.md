# Feature Specification: Per-user resumes and everything hanging off them (issue #10, slice 4 of 6 of #5)

**Status**: Draft
**Input**: Issue #10. Shared job catalog, private per-user workspace (ADR 0065-0067). A resume is a person's own document: it, what was learned from it (scan, reviews, comparisons, confirmed facts), what was written with it (cover letters) and what the worker prepared with it (application packs) belong to that person.

## User Scenarios & Testing

### User Story 1 - My resumes are mine (Priority: P1)
A signed-in person sees, uploads, scans, reviews, edits, renders and deletes only their own resumes. Another person's resume id answers "not found" on every page and action. The default resume, the resume pickers and the resume-to-search link offer only the person's own resumes.

**Why this priority**: the point of the slice; a resume holds a person's career history.

**Independent Test**: two users each upload a resume; each list, picker, detail page, download and delete sees one; user A requesting B's resume URL gets "not found".

**Acceptance Scenarios**:
1. **Given** A and B each with a resume, **When** A opens /resumes, **Then** only A's resumes are listed and A's default is A's.
2. **Given** B's resume id, **When** A requests its detail, download, render, review, scan, edit or delete route, **Then** the answer is "not found" and nothing changes.
3. **Given** A marks a resume as default, **Then** B's default is unchanged; each person has at most one default.
4. **Given** A's search points at A's resume, **When** B edits searches, **Then** B cannot link A's resume to a search.

### User Story 2 - Comparisons, reviews, facts and letters are mine (Priority: P1)
Comparisons (quick and full), strength reviews, confirmed or denied facts and cover letters are stored against the person's resume and read back only for that person. Two people comparing their own resumes against the same posting each get their own result; a stored comparison or letter of one never serves as the memo for the other. A posting-keyed reading with no resume in it (the posting brief and the company verification) stays shared.

**Acceptance Scenarios**:
1. **Given** A and B each compared a resume with one posting, **Then** each job page shows only that person's comparison and letters.
2. **Given** A confirmed that they know "Azure", **Then** B's comparisons do not count it as evidence and B is still asked.
3. **Given** a posting verified or briefed by A, **Then** B opening the posting they hold reuses the shared brief and verification without a new AI call.
4. **Given** a job page, target, letter, screen or resumes route that gets a job id, **Then** the posting must still be held by the person (unchanged rule).

### User Story 3 - The worker prepares packs per person (Priority: P1)
When a strong new match is stored for a person, the tick queues an application pack for that person, prepared with that person's resume, their search and their pack settings, counted against their own daily limit. The runner takes queued packs of every person, each run as its owner. A person's pack is visible and actionable only to them.

**Acceptance Scenarios**:
1. **Given** two people with pack preparing on and a posting strong for both, **Then** two packs are queued, one per person, and each is prepared from its owner's resume.
2. **Given** only B has preparing on, **Then** only B gets a pack.
3. **Given** A's pack for a posting, **When** B opens the pack routes for it, **Then** B sees their own (or none), never A's.
4. **Given** a daily limit, **Then** each person's auto packs count separately.

### User Story 4 - Existing installs keep working untouched (Priority: P1)
An install upgrading finds every resume, scan, review, comparison, fact, letter and pack unchanged and owned by the default user. An install without sign-in behaves exactly as before.

**Acceptance Scenarios**:
1. **Given** a database with resumes, matches, reviews, facts, letters, packs and applied-resume links, **When** the migration runs, **Then** all belong to user 1 and nothing is lost.
2. **Given** a user deleted, **Then** their resumes and dependents go with them.

## Requirements
- **FR-001** A resume has an owner; every resume list, picker, lookup, default rule and count is scoped to the person.
- **FR-002** Comparisons, reviews and letters belong to the person through their resume; every reader and memo lookup (comparison reuse, letter lists, per-job summaries) filters to the person's resumes.
- **FR-003** Confirmed and denied facts are per person; a term is unique per person.
- **FR-004** An application pack is per person and posting (one row each); the tick queues per owner, the runner prepares per owner with that owner's resume, search and settings, and the daily limit is per owner.
- **FR-005** The posting brief and the company verification stay shared (they are properties of the posting, no resume in the prompt); their readers still require the person to hold the posting.
- **FR-006** A search links only to a resume of the same owner; the lookups of searches that use a resume are scoped to the owner.
- **FR-007** A foreign id on any resume, match, review, letter, fact or pack route reads as "not found".
- **FR-008** The migration backfills the default user and is lossless; cascade on resume delete is preserved.
- **FR-009** Scripts and the worker pass the owning user; none may read another person's resume text.

## Success Criteria
- **SC-001** Two people never see or change each other's resumes, comparisons, reviews, facts, letters or packs (isolation checks pass).
- **SC-002** After upgrade a single-user install shows identical resume and pack content.
- **SC-003** A posting verified or briefed once is not paid for again by another person.

## Assumptions
- Employer mode (Screening, Applicant) is not scoped.
- The AI call ledger and AI keys stay install-wide (per-user AI keys out of scope); ledger rows keep a bare resume id.
- Notification targets, the mute list and personal settings are #11; "packs ready" messages still go to the install's targets, and pack settings stay install-wide unless already per-user.
- The /target scratch resume (hidden) is per person.

## Non-goals
Notifications, mutes and personal settings (#11), admin role and users page (#12), per-user AI keys, employer mode scoping.
