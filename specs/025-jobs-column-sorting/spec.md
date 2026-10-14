# Feature Specification: Sortable columns on the jobs page

**Feature Branch**: `issue-25-jobs-column-sorting`

**Created**: 2026-10-14

**Status**: Draft

**Input**: Issue #25 — "Enable sorting on the columns of the jobs page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sort the list by clicking a column header (Priority: P1)

A person looking at their jobs list wants to reorder it by what matters right now — highest fit, highest salary, newest fetch, company name — by clicking the header of that column instead of opening the "Sort by" menu (which offers only four orders).

**Why this priority**: This is the whole request; it is the discoverable way to reorder a table.

**Independent Test**: Open the jobs list, click "Fit": the highest scores come first. Click "Fit" again: the lowest come first.

**Acceptance Scenarios**:

1. **Given** the jobs list, **When** the person clicks the Title, Company or Status header, **Then** the list is ordered ascending by that column.
2. **Given** the jobs list, **When** the person clicks the Fit, Salary or Fetched header, **Then** the list is ordered descending by that column (best / largest / newest first).
3. **Given** the list is sorted by a column, **When** the person clicks that same header, **Then** the direction reverses.
4. **Given** rows with no value in the sorted column (no salary, no score, no company named), **When** sorted in either direction, **Then** those rows come last.
5. **Given** the Location header, **When** the person looks at it, **Then** it is plain text, not a sort control.

---

### User Story 2 - Sorting keeps the person's context (Priority: P1)

A person who has filtered the list (status tab, search text, place, minimum fit, …) sorts it and expects to stay in the same filtered view, starting from its first page.

**Why this priority**: A sort that drops filters or leaves the person on page 4 is worse than none.

**Independent Test**: Filter to "Remote" + a status tab, go to page 2, click a header: same filters, page 1, new order.

**Acceptance Scenarios**:

1. **Given** active filters and page 2, **When** a header is clicked, **Then** every filter is kept and the list shows page 1.
2. **Given** a sort, **When** the person pages forward and back, **Then** the order is stable and no row repeats or is skipped, even among equal values.

---

### User Story 3 - The current sort is visible and announced (Priority: P2)

The person can see which column the list is sorted by and in which direction, and a screen reader announces it.

**Why this priority**: Without it the control gives no feedback; required for accessibility.

**Independent Test**: Sort by Salary: the Salary header shows a direction arrow and is announced as sorted ascending/descending; other headers announce no sort.

**Acceptance Scenarios**:

1. **Given** a sorted column, **Then** its header shows a direction indicator and exposes its sort state to assistive technology.
2. **Given** the "Sort by" menu order "Recently posted" (which has no column), **Then** no header shows as sorted.
3. **Given** the page in any of the four interface languages, **Then** the header controls' labels are worded in that language.

---

### Edge Cases

- Old links and bookmarks with the existing `sort` values (`fetchedAt_desc`, `fitScore_desc`, `postedAt_desc`, `title_asc`) keep working and highlight the matching header where one exists.
- An unknown or malformed `sort` value is treated as the default order (recently fetched), as today.
- With a single search selected, the Fit column shows that search's score; sorting by Fit follows the score the person sees.
- Postings from aggregators carry their employer separately from the source; Company sorts by the name shown, not the source's name.
- On narrow screens, hidden columns have no header to click; the "Sort by" menu still reaches the main orders.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Title, Company, Fit, Salary, Status and Fetched headers MUST each be a control that sorts the list by that column.
- **FR-002**: A first click on a column MUST apply its natural direction: ascending for Title, Company, Status; descending for Fit, Salary, Fetched.
- **FR-003**: A click on the column the list is already sorted by MUST reverse the direction.
- **FR-004**: Rows with no value in the sorted column MUST come last in both directions.
- **FR-005**: Equal values MUST fall back to a fixed tie-break so that paging neither repeats nor skips rows.
- **FR-006**: Sorting MUST preserve every active filter and search term and return to the first page.
- **FR-007**: The sorted header MUST show a direction indicator and expose its sort state to assistive technology; unsorted sortable headers MUST expose none.
- **FR-008**: The Location header MUST NOT be sortable.
- **FR-009**: Every sort value accepted today MUST keep working with the same meaning; the existing "Sort by" menu MUST remain.
- **FR-010**: Company MUST sort by the company name the list shows (the employer where the source is an aggregator, else the company), Salary by the lower bound of the posted range, Status in the order of the status tabs.
- **FR-011**: New visible words MUST be present in every interface language.

### Key Entities

- **Sort order**: a column plus a direction, carried in the page address; the default is recently fetched.
- **Sortable column**: one of Title, Company, Fit, Salary, Status, Fetched, each with a natural default direction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can reorder the list by any of the six sortable columns in one click, and reverse it in a second.
- **SC-002**: With any filter combination, 100% of header clicks keep the filters and land on page 1.
- **SC-003**: Across all pages of a sorted list, every matching row appears exactly once.
- **SC-004**: Every previously valid sorted link still produces the same order as before.
- **SC-005**: The sort control is operable by keyboard alone and its state is announced by a screen reader.

## Assumptions

- Sorting stays server-side across the whole result set (not just the visible page).
- The sort is not remembered between visits; it lives in the address only.
- Out of scope: sorting by Location, sorting by several columns at once, saving a preferred sort per person, and any data model change.
- The existing four-option "Sort by" menu is kept because "Recently posted" has no column.
