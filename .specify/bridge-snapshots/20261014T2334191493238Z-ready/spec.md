# Feature Specification: Live Status page for a running job

**Feature Branch**: `issue-36-live-status-page`

**Created**: 2026-10-14

**Status**: Draft

**Input**: GitHub issue #36 — a page of its own for a run that is in progress, reached from Run history by a "Live Status" link.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a running job's live status from Run history (Priority: P1)

A person looking at Run history sees a row marked Running. In that row's "What happened" cell there is a link, "Live Status". They follow it and land on a page about that one run: what it is doing now, how far along it is, how long it has been going, and whether it has gone quiet. The page keeps itself current without a reload.

**Why this priority**: This is the whole request. Today a long run shows only a badge in the history table, and the "Running now" card sits above the table with no room for detail or a stable address.

**Independent Test**: With one run in the Running state, open Run history, follow "Live Status" in its row, and see that run's stage, progress, elapsed time and counters update on their own.

**Acceptance Scenarios**:

1. **Given** a Run history row whose status is Running, **When** the page is shown, **Then** that row's "What happened" cell contains a link with the text "Live Status" that leads to the page for that run.
2. **Given** a Run history row whose status is not Running (finished, failed, or any other), **When** the page is shown, **Then** that row has no "Live Status" link.
3. **Given** the status page of a running job that reports progress, **When** it is open, **Then** it shows the job name, current stage, a progress bar with the done/total count, elapsed time, counters, the time-left estimate when one exists, and the time since the last report, flagged as stalled when the report is old — the same facts the "Running now" card shows.
4. **Given** the status page is open and the run reports new progress, **When** a few seconds pass, **Then** the page shows the new values without a manual reload.
5. **Given** a running job that has never reported progress, **When** its status page is opened, **Then** it shows the job name and elapsed time, and no progress bar.

---

### User Story 2 - See how the run ended (Priority: P2)

A person has the status page open when the run finishes, or opens a saved link to a run that has already ended. The page tells them the outcome instead of showing a stale "running" view.

**Why this priority**: The page will outlive the run: people leave it open or bookmark it. Without this it would mislead.

**Independent Test**: Open the status page of a run, let the run finish, and see the page switch to the final status and the one-sentence summary that Run history shows for it, with a way back to Run history.

**Acceptance Scenarios**:

1. **Given** the status page of a run that has ended OK, **When** it is shown (or the run ends while it is open), **Then** it shows the final status, duration, and the same summary sentence the Run history row shows, plus a link back to Run history, and it no longer refreshes.
2. **Given** a run that ended in failure, **When** its page is shown, **Then** it shows the failed status and the same failure sentence the history row shows.

---

### User Story 3 - Links that do not lead anywhere useful fail gently (Priority: P3)

A person follows a link to a run that does not exist or that belongs to another person.

**Why this priority**: Bookmarks go stale and runs are pruned; the page must not error or leak another person's run.

**Independent Test**: Open the page for an unknown id and for a run another member owns; each returns to Run history with a short message.

**Acceptance Scenarios**:

1. **Given** an id with no run, **When** its page is requested, **Then** the person is sent to Run history with a message that the run was not found.
2. **Given** a run that belongs to another person (a recap or nudge of theirs), **When** the page is requested, **Then** the answer is the same as for an unknown id.
3. **Given** an id that is not a number, **When** the page is requested, **Then** the answer is the same as for an unknown id.

---

### Edge Cases

- The run ends between the history page loading and the link being followed: the status page shows the final outcome (Story 2).
- The worker dies mid-run: the row stays Running, its last report ages, and the page shows it as stalled (the existing staleness rule).
- Page is open in a background browser tab: no polling while hidden, catching up when shown (as the Running-now card does).
- Script is blocked: the page reloads itself on a timer while the run is going.
- A manual "Fetch now" run: it has its own live page and keeps it. Its worker-side history row, if any, gets the same link like any other Running row.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each run in the history MUST have a status page at a stable address built from its id.
- **FR-002**: In Run history, a row whose status is Running MUST show a link with the exact text "Live Status" in its "What happened" cell, leading to that run's status page; every other row MUST show no such link.
- **FR-003**: While a run is Running, its status page MUST show the facts the "Running now" card shows: job name, stage, progress count and bar, unit, counters, time-left estimate or "no estimate", elapsed time, time since last report and the stalled warning.
- **FR-004**: While a run is Running, the status page MUST update itself every few seconds without a reload, MUST NOT ask while the browser tab is hidden, and MUST fall back to a timed reload when script is unavailable.
- **FR-005**: When a run is not Running, its status page MUST show the final status, duration and the same summary sentence Run history shows for it, and MUST NOT keep refreshing. A page that was open when the run ended MUST switch to this view on its own.
- **FR-006**: Every status page MUST offer a link back to Run history.
- **FR-007**: A request for a run that does not exist, is not numeric, or is not visible to the person (the install's runs and their own recaps and nudges are visible; another person's are not) MUST be answered by sending the person to Run history with a message, and MUST NOT reveal whether the run exists.
- **FR-008**: The page MUST be available to every signed-in person, members included, like Run history itself.
- **FR-009**: Every sentence the page adds MUST exist in every interface language, and the page MUST pass the route smoke, including the pseudo-language pass.
- **FR-010**: The existing manual "Fetch now" live page and the "Running now" card MUST keep working unchanged.

### Key Entities

- **Run**: one row of Run history — job name, start, end, status, summary stats, and (while Running) the latest progress report. The status page is a view of exactly one run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From Run history, a person reaches a running job's live status in one click.
- **SC-002**: A progress change reported by a running job is visible on its status page within 10 seconds, with no reload.
- **SC-003**: 100% of Running rows in Run history carry the "Live Status" link and 0% of other rows do.
- **SC-004**: A status page left open across the end of a run shows the final outcome within 10 seconds of the run ending.
- **SC-005**: A request for a missing or foreign run never shows an error page and never exposes another person's run.

## Assumptions

- "Job history screen" means the Run history table on the Runs page; "run status screen" is a new page for one run, since only a manual Fetch now run has a page of its own today.
- The progress data, its wording and the staleness rule come from #32 and are reused as they are.
- Visibility follows the existing rule for Run history: install runs plus the person's own.
- Refresh interval is the same few seconds as the Running-now card.
- Out of scope: cancel or pause controls, progress history, changes to the manual Fetch now page.
