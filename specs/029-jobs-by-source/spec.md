# Feature Specification: Jobs by source panel on the Overview

**Feature Branch**: `issue-29-jobs-by-source`

**Created**: 2026-10-14

**Status**: Draft

**Input**: Issue #29 — "Overview: jobs-by-source panel". Add a panel beside "Jobs by stack" that shows where the matches came from (Gmail, company boards, and so on) instead of which technologies they name.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See which sources produce my matches (Priority: P1)

A person looking at the Overview wants to know where their matches come from — their Gmail label, the company boards they watch, the aggregators — so they can tell which sources earn their place and which could be switched off.

**Why this priority**: This is the whole request.

**Independent Test**: With matches from Gmail, a Greenhouse board, a Lever board and RemoteOK in the last 30 days, open the Overview: a "Jobs by source" panel lists "Company boards" (the two vendor boards together), "Gmail" and "RemoteOK", each with its match count and a bar sized to its share.

**Acceptance Scenarios**:

1. **Given** matches from several per-company vendor boards (Greenhouse, Lever, Ashby, …), **When** the panel is drawn, **Then** they appear as ONE "Company boards" bar whose count is their sum.
2. **Given** matches from any other source (Gmail, Folder, Import, pasted jobs, an aggregator, a feed, a careers page), **When** the panel is drawn, **Then** each source has its own bar, named as the rest of the dashboard names it.
3. **Given** more than eight sources, **When** the panel is drawn, **Then** the eight with the most matches show, most first.
4. **Given** the panel, **When** read, **Then** it states how many matches the counts are out of and that the window is the last 30 days.
5. **Given** no match in the last 30 days, **When** the Overview is drawn, **Then** the panel is not shown.

---

### User Story 2 - The panel reads like its neighbour (Priority: P2)

The panel looks and behaves like "Jobs by stack" so it needs no explanation, and works in every interface language.

**Why this priority**: Consistency and the language rule; secondary to the numbers being right.

**Independent Test**: View the Overview in each of the four languages: the panel's title, hint and "Company boards" label are worded in that language; source names that are product names stay as written.

**Acceptance Scenarios**:

1. **Given** the Overview, **When** viewed, **Then** the source panel sits with the stack panel and uses the same bar, count and footer layout.
2. **Given** a source named by the catalog (Feed, Careers page, Folder, Import, Pasted), **When** the interface language changes, **Then** its name follows the language; a vendor or aggregator name stays as written.
3. **Given** a bar, **When** hovered or focused, **Then** nothing navigates: bars are plain, not links.

---

### Edge Cases

- Matches are counted the way the stack panel counts them: the person's own kept postings of the last 30 days, muted employers left out, whatever the person did with them since.
- A source that is switched off or whose company row was removed still counts for matches already stored in the window.
- The shares are relative to the matches in the window, so a source that names no technology still counts here (unlike the stack panel, which counts only matches naming technologies).
- A single source only: the panel shows one full bar rather than hiding.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Overview MUST show a "Jobs by source" panel next to "Jobs by stack" whenever the last 30 days hold at least one match, and MUST NOT show it otherwise.
- **FR-002**: The panel MUST count the same matches as "Jobs by stack", grouped by the source each posting came through.
- **FR-003**: Per-company vendor boards MUST be merged into one "Company boards" entry; every other source MUST be its own entry.
- **FR-004**: Entries MUST be ordered by count, most first, with at most eight shown; ties MUST fall in a fixed order so the panel does not reshuffle between reloads.
- **FR-005**: Each entry MUST show its count and a bar proportional to its share of the matches in the window.
- **FR-006**: The panel MUST state the window (last 30 days) and the total the counts are out of.
- **FR-007**: Source names MUST be those the dashboard already uses elsewhere, in the reader's language where the dashboard words them.
- **FR-008**: The panel's bars MUST NOT be links, and "Jobs by stack" MUST be unchanged.
- **FR-009**: New visible words MUST be present in every interface language.

### Key Entities

- **Source entry**: a label and a count of matches; either the merged "Company boards" or a single source kind.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can read, from the Overview alone and without opening another page, which source produced the most matches in the last 30 days.
- **SC-002**: The entry counts add up to the total stated in the panel's footer (when no more than eight sources exist).
- **SC-003**: With any number of vendor boards, the panel shows them as a single entry.
- **SC-004**: The Overview's other panels show the same numbers as before the change.

## Assumptions

- The 30-day window is the one "Jobs by stack" already uses (a dismissed posting is deleted after 30 days, so nothing older is complete).
- "Source" means the kind of source (Gmail, Folder, RemoteOK, …), not a single company: the person's boards are one entry because the question is "boards or aggregators or Gmail", not "which employer".
- Out of scope: a click-through filter on the chart or the jobs list, per-company breakdowns, a source filter for the chart, a data model change, and any change to the stack panel.
- Shipped as patch release v2.59.2 by a separate release PR (version, changelog, tag, release).
