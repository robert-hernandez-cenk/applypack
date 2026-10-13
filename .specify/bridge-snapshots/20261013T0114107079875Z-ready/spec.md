# Feature Specification: Per-user job state (issue #9, slice 3 of 6 of #5)

**Status**: Draft
**Input**: Issue #9. Shared job catalog, private per-user workspace (ADR 0065, 0066). A posting is stored once; what a person does with it (status, notes, applications, their best score, held alerts) belongs to that person.

## User Scenarios & Testing

### User Story 1 - My inbox and my pipeline are mine (Priority: P1)
A signed-in person sees only postings that were matched to, or added by, them. Saving, dismissing, applying, notes, recruiter contact, pipeline stage and its history are theirs: another person's actions never change what they see.

**Why this priority**: the point of the slice; resumes, alerts and the users page all assume a private pipeline.

**Independent Test**: two users, one posting both kept; A applies and moves the stage, B dismisses; each list, board, applications page and counts reflect only their own action.

**Acceptance Scenarios**:
1. **Given** a posting kept by A's and B's searches, **When** A marks it Applied, **Then** B still sees it as New and A's Applications page lists it alone.
2. **Given** a posting only B's search kept, **When** A opens /jobs or its URL, **Then** it is not listed and the URL answers "job not found".
3. **Given** A's chips, counts and overview figures, **Then** they count only A's postings and A's searches.
4. **Given** A pastes or imports a posting, **Then** only A sees it, and a later re-score never shows it to anyone else.

### User Story 2 - Existing installs keep working untouched (Priority: P1)
An install upgrading from before this slice finds every posting with the same status, notes, score, stage and history, owned by the default user. An install without sign-in behaves exactly as before.

**Acceptance Scenarios**:
1. **Given** a database with jobs in every status, stages, events, held alerts and applied resumes, **When** the migration runs, **Then** each job has one row for the default user carrying those values, and the old columns are gone from the shared posting.
2. **Given** an install without sign-in, **When** a fetch tick runs, **Then** results, alerts and counts match the previous release.

### User Story 3 - Each person's searches decide their own verdict (Priority: P1)
A posting is still classified once against every running search of every person. The verdicts are grouped by owner: each person gets their own best-of score, summary, flags, New/Dismissed status, and their own alert (to the target of their winning search) and held-for-later stamp.

**Acceptance Scenarios**:
1. **Given** A's search keeps a posting and B's searches all dismiss it, **Then** it is New for A, Dismissed for B, and only A is alerted.
2. **Given** a paused or prefiltered store, **Then** every person gets the posting unscored (prefiltered: dismissed) as before.
3. **Given** a re-score, **Then** each person's row is updated by their own searches; Applied and Saved never move; a person without running searches keeps their rows untouched; a catalog posting not yet in a person's list appears in it when their searches keep it.

### User Story 4 - Background reports are per person (Priority: P2)
The digest, the stale-applications nudge, cleanup of dismissed postings, the funnel and the overview read each person's own rows. Until notifications are scoped (#11), the install's targets still receive them; the worker runs them for the default user.

## Requirements
- **FR-001** A per-person job row holds status, best-of score, tech match, red flags, summary, priority rules applied, alerted/held stamps, application fields (applied at, recruiter, stage, notes) and the resume the application used; the shared posting holds none of them.
- **FR-002** Stage history belongs to a person.
- **FR-003** A person sees a posting only if they have a row for it; foreign ids behave as missing.
- **FR-004** The migration creates one row per existing job for the default user from the old columns and per-event ownership for the default user, without data loss.
- **FR-005** Ingest, re-score and every dashboard reader follow the rules in the scenarios above.
- **FR-006** Salary, place, fingerprint and cross-listing stay on the shared posting.
- **FR-007** A dismissed posting is removed from the shared catalog only when nobody still holds it in any status other than Dismissed after the retention period; a person's dismissed row alone is removed after the period.

## Success Criteria
- **SC-001** Two people acting on the same posting never see each other's status, notes or stage (isolation checks pass).
- **SC-002** After upgrade a single-user install shows identical counts per status and identical applications as before.
- **SC-003** Each posting is classified once regardless of the number of people.

## Assumptions
- Notification targets, resumes and their dependents (letters, briefs, comparisons, verifications, application packs) are not scoped here (#10, #11); where the split forces a read, the default user or the current user is used and noted.
- A person created after postings were stored sees nothing until a re-score or new fetch gives them rows.
- Alerts: one per person per posting; targets stay install-wide, so a broadcast chat may receive one per person.

## Non-goals
Notification targets/mutes (#11), resumes (#10), users page and roles (#12), per-user AI keys, employer mode.
