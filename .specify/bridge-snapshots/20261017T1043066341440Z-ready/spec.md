# Feature Specification: Jobs list opens on New

**Feature Branch**: `issue-51-jobs-default-new-tab`

**Created**: 2026-10-17

**Status**: Draft

**Input**: GitHub issue #51 — "Jobs list: default to New, move All to the last tab".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the jobs list on what is new (Priority: P1)

A person opens Jobs from the menu. The list shows the postings still waiting for a decision (status New), and the tab strip reads New, Alerted, Applied, Saved, Dismissed, All, in that order.

**Why this priority**: This is the whole change. The tab people want first is New; the old default mixed every status together.

**Independent Test**: Open `/jobs` with no query. Only New postings are listed, the New tab is highlighted, and All is the last tab.

**Acceptance Scenarios**:

1. **Given** postings in several statuses, **When** the person opens `/jobs` with no status, **Then** only New postings are listed and New is the current tab.
2. **Given** the same data, **When** the person opens `/jobs?status=` (an explicit empty value), **Then** the result is the same as a bare `/jobs`.
3. **Given** any state, **When** the page renders, **Then** the tabs read New, Alerted, Applied, Saved, Dismissed, All, and each tab's count is what it was before (All is the sum of the statuses).

---

### User Story 2 - Reach everything on purpose (Priority: P1)

A person who wants every status picks the All tab. It has its own address (`status=all`), lists every status, and stays selected while they filter, search, sort and page.

**Why this priority**: Without a distinct value for "everything", moving All off the default would remove the way to see all postings.

**Independent Test**: Open `/jobs?status=all`. Postings of every status are listed and All is highlighted. Apply a filter, a search, a sort and go to page 2: every link keeps `status=all`.

**Acceptance Scenarios**:

1. **Given** postings in several statuses, **When** the person opens `/jobs?status=all`, **Then** all are listed and All is the current tab.
2. **Given** the All tab, **When** the person uses a filter, search, sort or pagination link, **Then** the link keeps the All tab; the same holds for every other tab.
3. **Given** a status value that is neither empty, `all` nor one of the five statuses, **When** the page is requested, **Then** it is refused with the same 400 as today.

---

### User Story 3 - Links that meant "everything" still mean it (Priority: P2)

Links elsewhere in the app that stood for the unfiltered list ("All jobs", "See all jobs", the back link on a job page, the breadcrumb on the tailoring page, and the links that narrow by search, country, muted companies or watched companies) keep showing every status, so a person following them does not find postings hidden. Links that already name a status, the menu link, and the "Open your jobs" buttons on empty pages are unchanged.

**Why this priority**: Without the audit the new default would silently hide postings behind those links.

**Independent Test**: Follow each of those links and see all statuses; follow the Overview status cards and see the status they name.

**Acceptance Scenarios**:

1. **Given** a link labelled "All jobs" or "See all jobs", **When** followed, **Then** the All tab is shown.
2. **Given** a link that already names a status, **When** followed, **Then** that status is shown, as before.

---

### Edge Cases

- A person with no postings at all sees the plain "no jobs yet" empty page on `/jobs`; a person who has postings, but none New, sees the "filters hide everything" empty page with a clear-filters button rather than a message saying nothing was found yet.
- "Clear all filters" lifts the panel filters and keeps the tab, as before; the empty-page button that goes to bare `/jobs` lands on New.
- An old bookmark `/jobs?status=` now lands on New (accepted).
- Rows in the Dismissed, Applied and other tabs behave as before, including their counts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A request for the jobs list with no status, or an empty one, MUST show the New postings.
- **FR-002**: The value `all` MUST show postings of every status; any of the five statuses MUST show that status; any other value MUST be refused with the existing 400.
- **FR-003**: The tab strip MUST read New, Alerted, Applied, Saved, Dismissed, All, with All linking to the `all` value.
- **FR-004**: The current tab MUST be highlighted from the resolved status, and every filter, search, sort, pagination and clear-filters link MUST keep it, including All.
- **FR-005**: Tab counts MUST be unchanged; the All count remains the sum of the statuses.
- **FR-006**: Links that meant the unfiltered list MUST carry the `all` value; links that name a status, the menu link and the "Open your jobs" buttons MUST NOT change.
- **FR-007**: When the New tab is empty and the person has other postings, the empty page MUST be the filters-hide-everything one; the "no jobs yet" page is for a person with no postings.
- **FR-008**: The status rule MUST live in one tested place; the route and the page read the same resolved value.

### Key Entities

- **Jobs status selection**: one of the five job statuses, or "all"; the page's current tab. Not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening Jobs shows only New postings with no click needed.
- **SC-002**: Every posting remains reachable in one click (the All tab), and every link that used to show all of them still does.
- **SC-003**: Five status inputs (missing, empty, `all`, a valid status, an invalid one) each resolve as listed in FR-001/FR-002, covered by automated tests.
- **SC-004**: No page in the full route smoke returns an error because of the change.

## Assumptions

- Spec directory number is the issue number (051).
- No schema, setting or remembered-tab change; sorting and counts are untouched.
- The release is a patch bump.
- Docs: the `docs/where-to-look.md` row for the list is updated.
