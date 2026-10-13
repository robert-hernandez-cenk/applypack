# Feature Specification: Per-user notifications, mutes and personal settings (issue #11, slice 5 of 6 of #5)

**Status**: Draft
**Input**: Issue #11. Shared job catalog, private per-user workspace (ADR 0065-0068). What a person is told, where, when, which companies they have muted and how their own dashboard behaves are theirs; what runs the install (fetching, sources, AI engine) stays shared.

## User Scenarios & Testing

### User Story 1 - My chats get my alerts, and only mine (Priority: P1)
A person adds Telegram and Discord destinations of their own. Alerts, held-alert deliveries, the daily recap, the stale-applications nudge and the "packs ready" message go only to that person's active destinations. A search with no chosen destination broadcasts to that person's destinations, not to everyone's. A destination of another person cannot be chosen for a search, toggled or deleted.

**Why this priority**: today two people on one server would read each other's matches in each other's chats, and a shared chat would get one alert per person.

**Independent Test**: users A and B each own one target; a match that both keep sends exactly one message to A's target and one to B's; a broadcast search of A never reaches B's target.

**Acceptance Scenarios**:
1. **Given** A and B with one active target each and one posting both keep, **When** the tick alerts, **Then** A's target gets A's alert and B's gets B's, and no target gets two.
2. **Given** A's search without a chosen destination, **Then** its alerts go to all of A's active targets and none of B's.
3. **Given** B's target id, **When** A tries to toggle, delete, test it or pick it for a search, **Then** the answer is "not found" and nothing changes.
4. **Given** A has no active target, **Then** A's matches stay New with nothing held, while B's alerts still go out.
5. **Given** held alerts of A and B that both fall due, **Then** each person gets one grouped message per target, never a merged one.

### User Story 2 - My alert switch, timing and digest are mine (Priority: P1)
Each person sets alerts on or off, the alert mode (instant, window, digest), window hours and days, digest hours, the stale-nudge and application-tracking toggles, their own time zone. The recap and the nudge are sent at that person's digest hours, covering what arrived since that person's last recap.

**Acceptance Scenarios**:
1. **Given** A has alerts off and B on, **Then** only A's matches are held and B's are sent at once.
2. **Given** A's digest hour is 09:00 and B's 19:00, **Then** at 09:00 only A's recap runs and at 19:00 only B's, each recorded as its own run.
3. **Given** B's last recap ran at 19:00, **Then** A's next window starts at A's last recap, not B's.
4. **Given** A turns the stale nudge off, **Then** B's nudge still goes out.

### User Story 3 - My mutes and re-apply window are mine (Priority: P1)
The company mute list and the "do not re-apply for N days" window belong to the person. A posting is turned away before any AI spend only when every person it could reach turns it away; otherwise each person who muted that employer (or applied inside their own window) just gets no row for it. Jobs lists hide only that person's muted companies. Another person's application never triggers my re-apply window.

**Acceptance Scenarios**:
1. **Given** A muted "Acme" and B did not, **When** a posting from Acme is fetched, **Then** B gets a row and an alert, A gets neither.
2. **Given** both muted it, **Then** it is turned away before classification, as today.
3. **Given** B applied to Acme 10 days ago and A has a 30 day window, **Then** A is not affected.
4. **Given** A unmutes Acme, **Then** B's mutes are unchanged.

### User Story 4 - My dashboard settings are mine (Priority: P2)
Pipeline stages, cover-letter angles, application-pack settings (switch, floor, limits, policy, cover letter), interface language and the display time zone are per person. The pack runner prepares each pack with its owner's settings, mutes and cover angles; switching packs off for one person cancels only that person's queued auto packs.

**Acceptance Scenarios**:
1. **Given** A chose German and B English, **Then** each dashboard page, alert, recap and nudge is worded in its owner's language.
2. **Given** only B has packs on, **Then** only B's matches queue a pack, and A turning packs off never cancels B's queue.
3. **Given** A reorders pipeline stages, **Then** B's board is unchanged.

### User Story 5 - Install-wide settings stay shared and existing installs keep working (Priority: P1)
Fetch schedule and pause, sources, discovery, classifier mode, AI engine/keys/budget, source keys, update check, employer mode, screening retention and the setup wizard flag stay one set for the install. Operator notices (AI budget warning, changed careers page, failing-source line in the recap) go to administrators' destinations. An upgrading install finds its settings, targets and mutes owned by the default user, unchanged; an install without sign-in behaves exactly as before; the `.env` bootstrap of targets goes to the default user.

**Acceptance Scenarios**:
1. **Given** a database with settings, targets, mutes and run history, **When** migrated, **Then** the default user holds the personal values, targets and mutes, and nothing is lost.
2. **Given** a member saves the schedule form, **Then** only their alert part and zone are stored; an administrator's save also stores the fetch part and the install's zone.
3. **Given** a new user with no settings row, **Then** defaults apply (alerts on, instant, packs off, English, install zone) and a row appears on first write.
4. **Given** a user is deleted, **Then** their settings, targets and mutes go with them.

## Requirements
- **FR-001** `AppSettings` columns are classified global or personal in a pure module; a test fails if a column is in neither list. Personal values live in `user_settings` (one row per user, created on first use with defaults).
- **FR-002** Personal: alerts on/off, alert schedule and personal zone, application tracking, stale nudge toggle, re-apply days, cover angles, pipeline stages, pack settings, language. Global: everything else, as recorded in the ADR table.
- **FR-003** The stored schedule is split: the fetch part and its zone stay global; the alert part and the personal zone are personal. Merging gives the same `Schedule` object callers use today.
- **FR-004** Notification targets have an owner; uniqueness of a destination is per owner; every list, toggle, delete, test, pick and send is scoped to the person.
- **FR-005** `Profile.notificationTargetId` must name a target of the profile's owner; null broadcasts to that owner's active targets.
- **FR-006** Instant alerts, held-alert delivery, recap, stale nudge, packs-ready message and the alert channel check take the owning user; held groups are per user and target.
- **FR-007** The recap and nudge run per user at that user's digest hours; a run row records its user; "since the last recap" is read per user (legacy rows count for the default user).
- **FR-008** The mute list is per person (key unique per person); the tick builds each person's employer rules; the re-apply window counts only that person's applications.
- **FR-009** A posting that every candidate recipient turns away is dropped before classification; otherwise a person who turns it away gets no row and no alert.
- **FR-010** Operator notices go to the active targets of all administrators whose alert switch is on.
- **FR-011** The pack runner, `noLongerWanted`, `listUnnotifiedPacks` and `cancelQueuedAutoPacks` read and act on the pack owner's settings, mutes, targets and angles.
- **FR-012** The dashboard reads and writes personal settings for `currentUser()`; the display zone and language come from the current user's settings.
- **FR-013** The migration backfills the default user, drops moved columns and is lossless; the `.env` bootstrap and operator scripts address the default user.
- **FR-014** A foreign id on any target, mute or settings route reads as "not found".

## Success Criteria
- **SC-001** Two people's alerts, recaps, nudges and notices reach only their own destinations; a shared chat never gets duplicate alerts for one posting from one person.
- **SC-002** After upgrade a single-user install sends the same messages at the same times as before.
- **SC-003** One person's settings change never changes another person's pages, messages or queue (isolation checks pass).

## Assumptions
- Until slice #12, global settings stay editable by any signed-in user, except the fetch part of the schedule form which only an administrator writes (forced by the split).
- The setup wizard flag, source-health alert flag and AI budget are install-wide; a new member is not walked through the wizard.
- A person with no row defaults to the install's configured zone.
- Per-user AI keys and employer mode are out of scope.

## Non-goals
Admin role UI and gating, users page, deleting users from the UI (#12); per-user AI keys; employer mode scoping.
