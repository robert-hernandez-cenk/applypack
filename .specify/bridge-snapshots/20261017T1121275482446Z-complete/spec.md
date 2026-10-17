# Feature Specification: Consider, Applying and Expired stages; a collapsible No Offer column

**Feature Branch**: `issue-52-consider-applying-expired`

**Created**: 2026-10-17

**Status**: Draft

**Input**: GitHub issue #52 — "Applications: add Consider, Applying and Expired stages; group end states into a collapsible No Offer column".

## User Scenarios & Testing *(mandatory)*

Applying takes work: tailor the resume, write a letter, fill the form. Today the board starts at **Applied**, so
there is nowhere to park a posting while that happens, and the ends of the funnel are scattered (Rejected and
Ghosted sit in a "Closed" panel under the board, and a posting that simply went away has no place at all).

The board, left to right, becomes:

`Consider → Applying → Applied → (the person's own work columns; Screen, Tech, Onsite, Offer by default) → No Offer`

- **Consider**: "I might apply to this." The starting state. The person can come back to the posting, work on its resume, then move on.
- **Applying**: the application is in progress and not sent.
- **Applied**: sent. Keeps its meaning. The apply date is set here and only here.
- **Expired**: a new end state — the posting closed or went stale before an offer. Set by hand.
- **No Offer**: a new, visible, last column that groups the three end states **Rejected, Ghosted, Expired**. A card keeps its specific end state and shows it as a badge.

### User Story 1 - Park a posting in Consider (Priority: P1)

From a posting's page, the person presses **Consider**, placed immediately left of **Mark applied** (the row reads
`Consider | Mark applied | Save | Reopen`). The posting moves to the first column of the board. It is not an
application yet: nothing that reacts to "the person applied" reacts to it.

**Why this priority**: the whole feature exists to give a not-yet-applied posting a home; without it nothing else matters.

**Independent Test**: press Consider on a posting, open `/applications`, see the card in the first column; check the pack, the resume prompt, the company counts and the digest ignore it.

**Acceptance Scenarios**:

1. **Given** a posting with no stage, **When** the person presses Consider, **Then** the posting appears in the Consider column and the stage change is recorded in the stage history.
2. **Given** a posting in Consider, **When** the pack is offered, the "Applied with" resume question is asked, the company or source application counts are shown, the stale-applications digest runs, or the cleanup and offer-sync jobs run, **Then** the posting is not treated as applied by any of them, and the cleanup and sync jobs still keep it (a stage is a person's own work).
3. **Given** a posting that is Saved, **When** nothing else happens, **Then** it is not in Consider (Saved stays an inbox state and never enters Consider by itself).
4. **Given** application tracking is turned off, **When** the person opens a posting, **Then** no Consider button is shown.
5. **Given** a posting already in Consider, **Then** the Consider button is not offered again; a posting already marked applied does not offer it either.

---

### User Story 2 - Move through Consider → Applying → Applied (Priority: P1)

The person moves a card between any two stages from the board (drag, or the card's quick-move select) and from the
posting's page. Applying can be skipped: any stage can move to any stage. The apply date is set on reaching
**Applied** and on no other move.

**Why this priority**: it is the funnel the new stages exist for.

**Independent Test**: move a card Consider → Applying → Applied from the board; the apply date is empty after the first two moves and set after the third. Repeat Consider → Applied directly.

**Acceptance Scenarios**:

1. **Given** a card in Consider, **When** it is moved to Applying, **Then** it has no apply date and still counts as not applied everywhere.
2. **Given** a card in Applying, **When** it is moved to Applied from the board, **Then** the apply date is today (if it had none) and the card counts as applied.
3. **Given** a posting in Consider or Applying, **When** the person presses **Mark applied** (with a resume chosen), **Then** the posting becomes Applied, the apply date is set, and the resume snapshot is recorded, exactly as when the posting had no stage.
4. **Given** a posting with no stage, **When** the person presses Mark applied, **Then** it behaves exactly as today.
5. **Given** a card in Consider or Applying, **Then** its time line never says "applied N days ago" and has no stale warning for an apply date it does not have.

---

### User Story 3 - End states grouped in a No Offer column (Priority: P1)

Rejected, Ghosted and Expired cards are all shown in one visible last column, **No Offer**, each with a badge
naming its specific end state. A card dropped on No Offer becomes **Rejected**; the specific end state is changed
on the posting's page or with the card's quick-move select. A card already in an end state that is dropped on No
Offer stays as it is.

**Why this priority**: it replaces the hidden "Closed" panel and gives Expired a home.

**Independent Test**: put one card in each end state; all three show in the No Offer column with the right badge. Drag an active card onto it: it becomes Rejected. Drag a Ghosted card onto it: still Ghosted.

**Acceptance Scenarios**:

1. **Given** cards in Rejected, Ghosted and Expired, **When** the board is open, **Then** all three are in the last column, each with a badge naming its end state, and the column header counts all of them.
2. **Given** an active card, **When** it is dropped on No Offer, **Then** it becomes Rejected.
3. **Given** a Ghosted card, **When** it is dropped on No Offer, **Then** nothing changes.
4. **Given** a card, **When** the person uses the quick-move select or the posting's stage field, **Then** Expired, Rejected and Ghosted are each offered by name and can be chosen.
5. **Given** jobs held in a column the person has since removed ("Unfiled"), **Then** they remain reachable on the board in their own small panel, not mixed into No Offer.
6. **Given** the board's CSV and Markdown exports, **Then** they list the new stages in board order, in English.

---

### User Story 4 - Collapse No Offer on desktop (Priority: P2)

On a wide screen, the No Offer column can be collapsed horizontally to a narrow rail that still shows its title and
its count, and expanded again. The choice is remembered for that viewer on that browser. It works from the
keyboard and tells assistive technology whether it is expanded. On a phone the board looks as it does today.

**Why this priority**: valuable, but the board is complete without it.

**Independent Test**: collapse the column, reload — it stays collapsed; expand — it stays expanded. Operate the toggle with the keyboard alone. With browser storage blocked, the board still works, only without memory.

**Acceptance Scenarios**:

1. **Given** the board on a desktop viewport, **When** the person presses the column's toggle, **Then** the column becomes a narrow rail showing the title and count, and pressing again restores it.
2. **Given** a collapsed column, **When** the page is reloaded, **Then** it is still collapsed.
3. **Given** the toggle focused, **When** Enter or Space is pressed, **Then** it toggles; the toggle exposes an expanded/collapsed state.
4. **Given** a collapsed rail, **When** a card is dragged over it, **Then** it opens so the card can be dropped.
5. **Given** a phone-width viewport, **Then** no toggle is shown and the column is an ordinary stacked section.
6. **Given** browser storage is unavailable, **Then** nothing breaks; the column simply starts expanded each time.

---

### Edge Cases

- A posting that already has an apply date (backdated, or moved back from Applied) and is later put in Consider or Applying still counts as applied — the person said they applied.
- A person's own work column cannot be named like a fixed stage: `consider`, `applying`, `expired` and the No Offer column's own key are reserved, as `applied`, `rejected` and `ghosted` already are. A stored list that already holds one is cleaned the way a reserved key is today.
- Existing Applied, Rejected, Ghosted and work-column rows are untouched; there is no data migration.
- Pressing Consider on a posting the person does not hold is a "not found", not an error page.
- The quick-move select on a card never offers the card's own stage.
- A card moved with no stage ledger (tracking off) never reaches these routes; tracking-off behaviour is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The board MUST show its fixed columns in this order: Consider, Applying, Applied, the person's work columns, No Offer. The work columns, their order and their names are the person's and MUST NOT change.
- **FR-002**: Consider, Applying and Expired MUST be stages a posting can hold. Their keys, and that of the No Offer column, MUST be reserved so a person's own column cannot take them.
- **FR-003**: A posting in Consider or Applying MUST NOT count as applied in: the application pack's "kept as sent" rules, the "Applied with" resume prompt, and the stale-applications digest. (The counts shown before deleting a company or a source are NOT converted: they warn about what a delete removes, and it removes a Consider or Applying card too, so those cards stay counted there.) One shared rule decides "has this posting been applied to" (the posting's status is Applied, or it has an apply date, or it holds any stage other than Consider, Applying and Expired — a posting can close before it was sent).
- **FR-004**: The cleanup job and the daily offer sync MUST keep protecting a posting that holds Consider or Applying, as they do any stage.
- **FR-005**: The job page MUST offer a **Consider** button immediately left of **Mark applied** when application tracking is on and the posting is neither in Consider nor already applied. It moves the posting to Consider and records the change in the stage history. It MUST NOT change the posting's inbox status.
- **FR-006**: **Mark applied** MUST set the stage to Applied, set the apply date if empty, and record the chosen resume snapshot, when the posting has no stage, is in Consider, or is in Applying. A stage the person has already moved on to (a work column, an end state) MUST NOT be reset to Applied by it.
- **FR-007**: Moving a card to Applied from the board MUST set the apply date if it is empty. No other move into any stage sets the apply date, and no move clears it.
- **FR-008**: Any stage MUST be able to move to any stage, from the board (drag or quick-move) and from the job page.
- **FR-009**: The quick-move preselects the next stage in the new order: Consider → Applying → Applied → the work columns in order; the last work column → Rejected; an end-state card → the first work column. The select lists every stage except the card's own.
- **FR-010**: Rejected, Ghosted and Expired cards MUST all render in the No Offer column, each with a badge naming its specific state. The column MUST replace the "Closed" panel; its count is the sum of the three. Cards held in a removed column MUST remain reachable in their own panel.
- **FR-011**: Dropping an active card on No Offer MUST make it Rejected. Dropping a card already in an end state on No Offer MUST change nothing.
- **FR-012**: On desktop the No Offer column MUST collapse to a narrow rail showing its title and count and expand again; the state MUST be remembered per viewer; the control MUST be operable from the keyboard and expose its expanded state. Storage failure MUST NOT break the page. On mobile the layout MUST be unchanged by the collapse (no toggle).
- **FR-013**: A Consider or Applying card's time line MUST NOT mention an apply date it does not have, and MUST NOT be marked stale on one. Date-based lines for Applied, the work columns and end states are unchanged.
- **FR-014**: Every new word on screen MUST exist in all four interface languages (English, Spanish, French, Ukrainian) in the same change, and the board and job page MUST pass the pseudo-language check.
- **FR-015**: The decision MUST be recorded in an ADR that amends ADR 0025; the "where to look" guide, the changelog and the version MUST be updated (a patch release).
- **FR-016**: The route smoke MUST cover a posting put in Consider from its page, its move to Applying and Applied, and the board rendering the No Offer column with one card in each end state.

### Key Entities

- **Stage**: a label on a person's row for a posting (`pipelineStage`); a string, not an enumeration. Fixed ones: Consider, Applying, Applied, Rejected, Ghosted, Expired. The rest are the person's own.
- **End state**: Rejected, Ghosted or Expired. Grouped on the board as No Offer; each card keeps its own.
- **Has applied**: derived, never stored: status Applied, or an apply date, or any stage other than Consider, Applying and Expired.
- **Stage history**: the existing append-only ledger of stage changes; Consider and Applying changes are recorded in it like any other.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can put a posting in Consider in one press from its page, and sees it in the first board column on the next page load.
- **SC-002**: With one posting in each of Consider and Applying, every "has this been applied to" surface (pack, resume prompt, company counts, digest) reports zero applications from them; after Applied it reports one each.
- **SC-003**: All three end states appear in one last column with distinguishing badges; no end-state card is reachable only through a hidden panel.
- **SC-004**: The No Offer column can be collapsed, expanded, and remembered across a reload using the keyboard alone, and the board is fully usable with storage blocked.
- **SC-005**: Existing boards open unchanged: every previously stored Applied, work-column, Rejected and Ghosted card is in the same place as before.
- **SC-006**: The full pre-merge checks (types, unit tests, export audit, catalog parity, route smoke including the pseudo-language pass) pass.

## Assumptions

- The person already has application tracking switched on; when it is off the board and the stage controls are unavailable, as today.
- Entering Consider is by the button on the job page and by the board's own move controls only; Saved does not enter it (non-goal).
- Expired is set by hand. Setting it automatically from a posting's liveness is a follow-up (non-goal).
- The inbox status values (New, Alerted, Applied, …) are not changed by any of this; moving to Consider or Applying does not mark a posting Applied.
- A person's own work columns and the settings page that edits them are untouched; the settings page's guidance text about "Applied and Closed" is reworded to the new fixed ends.
- Dropping on a collapsed rail is helped by opening it for the drag; the open state during a drag is not remembered.
