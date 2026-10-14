# Feature Specification: Page target for resume tailoring

**Feature Branch**: `issue-38-resume-length-control`

**Created**: 2026-10-14

**Status**: Draft

**Input**: Issue #38 — "Resume tailoring: controls to shorten the resume to the highlights for a position". A seasoned candidate's resume runs 4+ pages. The tailoring flow (Tailor launcher → comparison → suggestions → editor → Save / Download) offers no control over length, so the person cannot ask for a shorter resume that keeps only the highlights relevant to the posting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask for a resume that fits N pages (Priority: P1)

A person with a 4-page resume opens the Tailor launcher, pastes a posting, picks their resume and chooses **Length: 2 pages** (the choices are *Keep as is*, *1 page*, *2 pages*, *3 pages*; *Keep as is* is the default). After the comparison, the suggestions include removals and condensed rewrites aimed at reaching the target: the least relevant roles and bullets for this posting go first, older roles shrink to a line or two, and the strongest evidence for the posting's must-haves stays. The person reviews the suggestions in the editor and applies them.

**Why this priority**: This is the whole request. Without the target, a veteran's resume can only be trimmed by hand, with no guidance on what the posting values.

**Independent Test**: Run a comparison of a resume over the 2-page estimate with the target set to 2 pages: the suggestions contain enough cuts that, applied, the estimate reaches the target; with *Keep as is*, the suggestions are those of today.

**Acceptance Scenarios**:

1. **Given** a resume estimated at 4 pages, **When** the person compares it with a posting at target *2 pages*, **Then** the suggestions propose cuts and condensed rewrites sized to the overshoot, ordered with the least relevant to this posting first.
2. **Given** the target is *Keep as is*, **When** the person compares, **Then** the behaviour, prompts and results are unchanged from today.
3. **Given** the resume already fits the chosen target, **When** the person compares, **Then** no length-driven cuts are proposed.
4. **Given** a cut would remove contact details or a keyword the posting wants, **When** suggestions are produced, **Then** that cut is withheld exactly as removals are today.
5. **Given** a target is chosen, **When** suggestions are shown, **Then** nothing in the resume changes until the person applies suggestions and saves; the original version stays.

---

### User Story 2 - See how long the resume is while editing (Priority: P2)

In the editor the person sees an approximate length — "≈ 3.4 of 2 pages" — that updates as they apply or undo cuts, so they know when the target is met. With *Keep as is*, the editor shows the plain estimate without a target.

**Why this priority**: Without a live number the person cannot tell whether applying the suggestions was enough; it makes P1 usable, but P1 delivers value without it.

**Independent Test**: Open a comparison made with a target, apply all removals: the figure falls and reads as met once at or under the target.

**Acceptance Scenarios**:

1. **Given** the editor is open on a comparison with a 2-page target, **When** the person applies cuts, **Then** the estimate updates without a reload.
2. **Given** the estimate is at or under the target, **Then** the figure reads as met.
3. **Given** the target cannot be met with the suggestions given (cuts held back by the safety gate), **Then** the figure still shows the remaining overshoot honestly.

---

### User Story 3 - The choice is remembered with the comparison (Priority: P3)

A comparison remembers the target it was made with. Re-opening it, asking for suggestions again or using "Rewrite all" keeps the same target; a new comparison with a different target is a different run.

**Why this priority**: Consistency of an existing flow; the feature works without it for a single sitting.

**Independent Test**: Make a comparison at 2 pages, reload the page and request suggestions again: the target is unchanged; compare again at 3 pages: a separate result.

**Acceptance Scenarios**:

1. **Given** a stored comparison made at *2 pages*, **When** suggestions are requested later, **Then** they use *2 pages*.
2. **Given** comparisons stored before this feature, **When** they are opened, **Then** they read as *Keep as is*.

### Edge Cases

- A resume so long that the target cannot be reached without cutting protected content: suggest what is allowed, show the remaining overshoot, never cut protected content.
- A very short resume with a target larger than its length: no length-driven cuts, estimate shown as already within.
- Pasted or one-off (scratch) resumes: the target applies to the comparison like any other; saving is unchanged.
- The estimate is character-based and approximate; it is labelled as such and never presented as an exact page count.
- Old stored comparisons without a target marker read as *Keep as is*.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Tailor launcher MUST offer a Length choice — *Keep as is* (default), *1 page*, *2 pages*, *3 pages* — alongside the existing controls.
- **FR-002**: The chosen target MUST accompany the comparison run, be stored with the resulting comparison, and distinguish runs (the same posting and resume at a different target is a separate run).
- **FR-003**: A comparison stored without a target MUST read as *Keep as is*.
- **FR-004**: With a target, the suggestions step MUST be told the estimated overshoot and MUST propose cuts and condensed rewrites ordered by least relevance to the posting, condensing older roles to a line or two and preserving the strongest evidence for the posting's must-haves.
- **FR-005**: The number of cuts the suggestions may propose MUST scale with the overshoot, so a 4-page resume is not held to the small default cap.
- **FR-006**: Every proposed cut MUST pass the existing removal safety gate (contact details and wanted keywords protected); the length target MUST NOT relax it.
- **FR-007**: Length cuts MUST appear as the existing strike-through removal and rewrite suggestions; nothing MUST change in the resume until the person applies them and saves; the original version MUST be kept.
- **FR-008**: With *Keep as is*, prompts, results and behaviour MUST be identical to before this feature.
- **FR-009**: The editor MUST show an approximate page estimate that updates live as edits are applied or undone, and, when a target exists, show it against the target and whether it is met.
- **FR-010**: The estimate computed on the server and in the browser MUST agree for the same text (one definition, guarded by a test), and MUST be labelled approximate.
- **FR-011**: Unattended pack preparation MUST NOT be affected by this feature.
- **FR-012**: Every new person-facing string MUST exist in all of the interface's languages.

### Key Entities

- **Page target**: *Keep as is* or 1–3 pages; chosen at launch, stored with the comparison.
- **Length estimate**: approximate pages from the resume text, and the overshoot against a target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person with a 4-page resume can reach a ≤ 2-page estimate by applying suggestions from a single comparison at target *2 pages*, without hand-picking cuts, in the typical case.
- **SC-002**: The Length choice is reachable from the launcher in one action and defaults to no change.
- **SC-003**: With *Keep as is*, the suggestions produced for the same inputs are unchanged from before.
- **SC-004**: In every length-driven suggestion set, no cut touches contact details or a wanted keyword.
- **SC-005**: The live estimate updates within one second of an edit being applied.

## Assumptions

- The estimate is characters ÷ the existing per-page constant (3,500); it is a guide, not a layout measurement.
- Targets above 3 pages are unnecessary; *Keep as is* covers anyone who does not want a limit.
- Only the interactive tailoring flow is in scope; the pack's unattended preparation keeps its own policy and does not read the target.
- Shortening is suggest-and-apply by the person's decision; automatic trimming is out of scope.
- Render fonts, margins and exact page layout are out of scope.
- Docs to keep in sync: `docs/where-to-look.md`, a new ADR 0073, `docs/TASKS.md`; the release is a patch bump.
