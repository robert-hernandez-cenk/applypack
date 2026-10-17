# Feature Specification: Condense as its own two-phase stage

**Feature Branch**: `issue-49-condense-two-phase`

**Created**: 2026-10-16

**Status**: Draft

**Input**: GitHub issue #49 — "Condense as its own two-phase stage before other suggestions". Follows #55 (one tailoring front door) and #48 (tailored copies).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cut what the posting does not need, and review the cuts (Priority: P1)

A person has compared a resume with a posting and opened the tailoring editor. The resume runs over the page target they chose (or they simply want it shorter). A "Condense" panel at the top of the suggestions offers a first step, **Find cuts**. It reads the resume against the posting and the comparison's keyword verdicts and proposes what to delete or shorten, sized to how far over the target the resume is. The person reviews each cut in the editor, accepts the ones they want and skips the rest.

**Why this priority**: Cutting is the part that competes worst with additions in one request. A request that only has to find cuts finds more, and better ones. It is the smallest slice that delivers value.

**Independent Test**: On a comparison of a resume over a 1-page target, press Find cuts, see a list of cuts, apply two of them in the editor, and see the editor text and the length meter shrink.

**Acceptance Scenarios**:

1. **Given** a comparison whose resume is over the chosen target, **When** the editor opens, **Then** the Condense panel is expanded, says how far over the target the resume is, and offers Find cuts.
2. **Given** the person presses Find cuts, **When** the run finishes, **Then** the cuts appear as the editor's removal cards, each quoting the exact text it would delete, and nothing is applied until the person accepts it.
3. **Given** a cut that would remove the contact line or text that carries a keyword the posting wants, **When** the cuts are produced, **Then** that cut is stripped of its quote and kept as advice only, never offered as a one-press delete.
4. **Given** a resume already within the target, or a comparison with no target, **When** the editor opens, **Then** the Condense panel is collapsed with a line saying so, and Find cuts is still available on demand.

---

### User Story 2 - Tighten the wording of what is left (Priority: P1)

After the person has accepted some cuts, the panel offers the second step, **Tighten wording**. It reads the editor's current text (cuts applied) and proposes shorter wording for lines that stay: fewer words, same facts, same numbers, same wanted keywords. Each proposal is an ordinary change card the person accepts or skips.

**Why this priority**: Wording changes depend on which cuts the person accepted, so they cannot be proposed in the same step. This is the second half of the stage.

**Independent Test**: After applying a cut, press Tighten wording and see change cards whose new wording is shorter than the text it replaces.

**Acceptance Scenarios**:

1. **Given** cuts have been proposed, **When** the person presses Tighten wording, **Then** the proposals are written against the text as it stands in the editor now, not the original.
2. **Given** a proposed wording that is not shorter than the text it replaces, **When** proposals are produced, **Then** it is not offered as a change.
3. **Given** a proposed wording that claims something the resume cannot support, **When** proposals are produced, **Then** the same gate that guards every other replacement refuses it.
4. **Given** the person has not yet run Find cuts, **When** Tighten wording is requested, **Then** the request is refused with a message pointing to Find cuts.

---

### User Story 3 - Refresh the other suggestions on the condensed text (Priority: P2)

Once the resume is condensed, the person can refresh the additions, keyword and replacement suggestions against the condensed text. Those suggestions no longer carry any cutting advice; the cuts the person already reviewed stay as they were.

**Why this priority**: The additions pass should see the resume that will actually be sent. It is valuable but the earlier stories stand alone.

**Independent Test**: With cuts applied, press Refresh suggestions; the new change and addition cards quote lines that exist in the condensed text, and the removal cards are unchanged.

**Acceptance Scenarios**:

1. **Given** a condensed editor text, **When** the person presses Refresh suggestions, **Then** the additions, keywords and replacements are written against that text.
2. **Given** a comparison with stored cuts, **When** suggestions are refreshed or a full comparison is made, **Then** the stored cuts are not overwritten or emptied.
3. **Given** a new comparison, **When** it is made, **Then** its suggestions contain no removals and no page-length instruction; cuts exist only through Condense.

---

### Edge Cases

- A run fails or times out: the panel shows the reason and the step can be pressed again; nothing stored changes.
- Two tabs press the same step at once: the second joins the run in flight instead of paying twice.
- The model proposes no cuts (the resume is already tight): the panel says so rather than showing an empty list.
- A comparison stored before this change holds cuts written by the old combined request: they still show and still work; the panel reports the step as not run through Condense.
- The person edits the text between the steps: Tighten wording reads whatever text is in the editor when it is pressed.
- Wording proposals whose quote is no longer in the text (edited away) are reported as unplaceable by the editor, as any stale change card is today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The comparison's main request and the suggestions request MUST NOT carry removal rules, a removals output, or the page-length instruction. Cuts are produced only by Condense.
- **FR-002**: The editor MUST show a Condense panel above the other suggestions, expanded when the resume is over the chosen page target and collapsed (still available) when it is within the target or the target is "keep".
- **FR-003**: Find cuts MUST read the resume text, the posting and the comparison's stored keyword verdicts, and propose at most the number of cuts the page-target plan allows (the default number when no target applies).
- **FR-004**: Every cut MUST pass the existing removal gate: the contact line and text carrying a wanted keyword can never be offered as a one-press delete.
- **FR-005**: Cuts MUST be stored on the comparison so they survive reloads, and shown through the existing removal cards; accepting a cut is a client-side editor action as today.
- **FR-006**: Tighten wording MUST run on the editor text sent with the request, MUST be refused until Find cuts has run for that comparison, and MUST store its proposals on the comparison.
- **FR-007**: Every wording proposal MUST pass the existing replacement gate and MUST be strictly shorter than the text it replaces; others are dropped.
- **FR-008**: Wording proposals MUST appear as ordinary change cards that the person accepts or skips, and MUST count in the editor's undo and apply-all behaviour like any other change.
- **FR-009**: Refresh suggestions MUST accept the editor's current text, write additions, keywords and replacements against it, and MUST leave stored cuts untouched.
- **FR-010**: The comparison MUST record the furthest condense step run, so the panel shows the right state and a repeated press of a finished step is a no-op or an explicit re-run.
- **FR-011**: Each step MUST run as a tracked run with a progress page, and a second press while one is in flight MUST join it.
- **FR-012**: Each step's model calls MUST be fenced like every other prompt, recorded in the AI usage ledger under its own feature name, and use the person's configured engine.
- **FR-013**: Every new word a person reads MUST be in every language catalog.
- **FR-014**: Comparisons stored before this change MUST keep opening, with their stored cuts and scores unchanged.

### Key Entities

- **Condense state of a comparison**: which step has run (none, cuts, wording), the stored cuts (the comparison's existing removals) and the stored wording proposals with the text they were written against.
- **Cut**: a section, place, what to delete, why, and the exact quote to delete.
- **Wording proposal**: a quote from the current text, shorter replacement wording, and why.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a resume over its page target, one press of Find cuts produces enough proposed cuts to cover at least the overshoot when all are accepted, or says plainly that it could not.
- **SC-002**: No cut offered as a one-press delete ever covers the contact line or a wanted keyword (verified over the unit test set).
- **SC-003**: Every accepted wording proposal makes its line shorter; none lengthens the resume.
- **SC-004**: A new comparison and a refresh of suggestions produce zero removals and contain no page-length instruction in their requests.
- **SC-005**: A person can go from comparison to a condensed, saved resume in three reviewed steps without leaving the editor page.

## Assumptions

- Each step is started by the person; the comparison never starts Condense on its own.
- The page-target values stay keep, 1, 2 and 3.
- The editor's existing client-side apply, undo and "Save as vN" flows (including tailored copies) are reused unchanged for the condensed text.
- Roughly 3,500 characters per page remains the length guide.
- A real-key run on a long resume is done by the author before merge; unit tests cover the builders, parsers and gates.

## Out of scope

- Running Condense automatically inside the comparison.
- Any change to scoring, keyword judgment or the target values.
- Condensing a resume outside a job's comparison.
