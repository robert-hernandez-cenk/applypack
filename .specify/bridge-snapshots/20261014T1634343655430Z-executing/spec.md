# Feature Specification: Live progress card for running jobs

**Feature Branch**: `issue-32-running-jobs-progress`

**Created**: 2026-10-14

**Status**: Draft

**Input**: Issue #32 — "Live progress card for running cron jobs on the Runs page". A long job (the hourly fetch classifying 663 postings with a local model ran about 2.5 h) shows on the Runs page only as `Running`: no stage, no progress, no estimate. The only way to know how long was left was to rebuild it from the worker's log and the AI call ledger.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how far a running search has got (Priority: P1)

A person opens the Runs page while the hourly search is classifying postings. Between the search funnel and the run history a "Running now" card names the job and its stage, shows a bar with "508 / 663", the time it has been running, what it has kept, set aside and failed so far, and "about 50 min left". The card updates by itself every few seconds, with no reload.

**Why this priority**: This is the whole request. The search is the job that runs for hours, and it runs in the worker, whose state the dashboard cannot see today.

**Independent Test**: Start a search with enough postings to classify, open /runs: the card shows the stage and a moving count; when the run ends the card disappears and the run appears in the history exactly as before.

**Acceptance Scenarios**:

1. **Given** a search that is classifying 663 postings and has done 508, **When** the person opens /runs, **Then** the card shows the job, the classifying stage, "508 / 663" with a proportional bar, the elapsed time and the counters.
2. **Given** at least 20 items done and a total, **When** the card is drawn, **Then** it shows an estimate of the time left from the recent rate, not the average since the start.
3. **Given** fewer than 20 items done, or no total, **When** the card is drawn, **Then** no estimate is shown ("no estimate" when there is no total at all).
4. **Given** the card is open, **When** the job moves on, **Then** the card shows the new count within about 10 seconds without a page reload.
5. **Given** the run finishes or fails, **When** the card next refreshes, **Then** it is gone, and the history row is unchanged by this feature.
6. **Given** no job is running, **When** /runs is opened, **Then** no card is drawn and nothing is polled.

---

### User Story 2 - Tell a stalled run from a slow one (Priority: P2)

Each block says "last update 12 s ago". When no update has arrived for more than about two minutes the line turns amber, so a crashed or stuck worker is visible without any extra machinery.

**Why this priority**: A row left `Running` by a crash would otherwise look alive forever; the card is the one place that makes the difference visible.

**Independent Test**: Leave a run's last update older than the threshold: its line is amber; a fresh update turns it back.

**Acceptance Scenarios**:

1. **Given** the last update was under two minutes ago, **When** the card is drawn, **Then** the line is the normal colour.
2. **Given** the last update was over two minutes ago, **When** the card is drawn, **Then** the line is amber and still reads the age.

---

### User Story 3 - Other long jobs show up too (Priority: P3)

Beyond the classify loop, the search reports its sources (done of total) while it reads them, and the Gmail job reports mails read of total, with the listings found as a counter. Any other job that has not been taught to report still appears in the card with its name and elapsed time.

**Why this priority**: The classify stage is the long one (P1); the others make the card complete, and the elapsed-only block means no job is invisible.

**Independent Test**: Run each job and see its stage and count; run one that reports nothing and see name and elapsed time only.

**Acceptance Scenarios**:

1. **Given** a search reading its sources, **When** the card is drawn, **Then** it shows the sources stage with sources done of total.
2. **Given** the Gmail job reading mails, **When** the card is drawn, **Then** it shows mails read of total and the listings found so far.
3. **Given** a running job that reports nothing, **When** the card is drawn, **Then** a block with its name and elapsed time is shown, no bar and no estimate.

### Edge Cases

- A failed progress write must never fail, slow or alter the job; the card just goes stale.
- Progress is written no more than about once every 5 seconds, except that a change of stage is always written.
- Two jobs running at once (a search and a Gmail read) give two blocks.
- A run that belongs to another person (a recap or nudge) is not shown to someone else; the install's own runs are shown to everyone who can open /runs.
- The total can grow or be unknown; the bar then does not claim a percentage.
- A run that crashed leaves its row `Running`: the card keeps showing it, amber, until it is dealt with elsewhere (a reaper is out of scope).
- A page opened without script falls back to loading the page again on an interval while a run is going.
- A run that reports a count above its total (a total that moved) is shown capped at 100%, never overflowing the bar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A running job MUST be able to report its progress (stage, a label, done and total counts with a unit, when the stage began, when it last reported, and named counters), and that report MUST be readable by the dashboard while the job is in flight.
- **FR-002**: A job that never reports MUST behave exactly as before.
- **FR-003**: Reports MUST be saved at most about once every 5 seconds, always on a change of stage, and a failure to save one MUST NOT fail or delay the job.
- **FR-004**: When a run ends, whether it succeeds or fails, its progress MUST be cleared, so history rows carry nothing new.
- **FR-005**: The search's classify loop MUST report items consumed of items to classify, with kept, set-aside, fell-back and error counters.
- **FR-006**: The search MUST report sources done of total while reading sources, and the Gmail job MUST report mails read of total with listings found as a counter.
- **FR-007**: The Runs page MUST show a "Running now" card between the search funnel and the run history, with one block per running row, and no card when none is running.
- **FR-008**: A block MUST show the job name and stage, a progress bar with "done / total" when a total is known, the elapsed time, the counters, and the age of the last update.
- **FR-009**: The estimate of time left MUST come from the rate over a recent window, MUST be hidden until about 20 items are done, and MUST read "no estimate" when there is no total.
- **FR-010**: The age of the last update MUST turn amber once it passes about two minutes.
- **FR-011**: The card MUST refresh itself about every 5 seconds while it exists, and fall back to reloading the page when script is unavailable.
- **FR-012**: The card MUST show the install's runs and the signed-in person's own, and no other person's; the endpoint that serves it MUST obey the same page-access rules as the Runs page.
- **FR-013**: Every word on the card MUST be in the interface language catalogs, with a line in each language.
- **FR-014**: The `Running` badge in the history table MUST stay.

### Key Entities

- **Run progress**: the live state of one running job — stage, label, done, total, unit, when the stage began, when it last reported, named counters. Exists only while the run is running.
- **Run**: the existing record of one job execution; gains the progress above while running and loses it at the end.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: During a long classification, a person can read how many postings are done and how many remain from /runs alone, without the log or the database.
- **SC-002**: The card's count is never more than about 10 seconds behind the job's.
- **SC-003**: After 20 items, the estimate is within 25% of the actual time left on a steady-rate run.
- **SC-004**: A worker that stops reporting is visibly stalled (amber) within 3 minutes.
- **SC-005**: A job that reports progress takes no more than 1% longer than without, and no job fails because of a progress write.
- **SC-006**: With no job running, the Runs page loads and behaves as before, with no polling.

## Assumptions

- The throttle (about 5 s), the amber threshold (about 2 min), the estimate floor (20 items) and the refresh period (about 5 s) are tunable constants, not user settings.
- Gmail's unit is mails; listings are a counter.
- The card follows the Runs page's existing access rule (the install's rows, plus the person's own).
- Manual "Fetch now" keeps its own in-memory progress page; it is not rebuilt on this mechanism.
- Out of scope: cancel or pause controls, a reaper for rows left `Running` after a crash, progress history.
