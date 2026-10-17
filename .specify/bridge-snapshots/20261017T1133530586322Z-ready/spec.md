# Feature Specification: Keyword edits that keep your place

**Feature Branch**: `issue-53-tailor-edits-no-reload`

**Created**: 2026-10-17

**Status**: Draft

**Input**: GitHub issue #53 — "Tailor resume: edits reload the page and scroll to top".

## User Scenarios & Testing *(mandatory)*

Tailoring a resume means going down a long list of keywords and correcting the model: this one is a must, that one
does not apply, add the word it missed. Each of those is one small edit. Today each edit sends the whole page away and
brings it back: the view jumps to the top, the person's place in the list is lost, the control they were using
loses focus, and on the tailor page the live editor starts over. A list of twenty corrections is twenty trips back
down the page.

The keyword controls live in two places, and both have the problem:

- the **tailor page** (`/jobs/:id/target`), beside the editor, and
- the job's **Resume match** tab (`/jobs/:id?match=…`).

After this change a keyword edit changes what it changes — the keyword's row, the score, the message saying what
happened — and nothing else. The page does not move.

### User Story 1 - Correct keywords without losing my place (Priority: P1)

A person scrolled halfway down the keyword list changes a keyword's level, ignores one, restores one, resets one,
removes one they added, or adds a word the model missed. The list updates in place, the score moves to its new
value, a message says what happened, and the page stays where it was with the control they used still focused.

**Why this priority**: This is the whole issue. Every other story protects or extends it.

**Independent Test**: On a stored comparison with a long keyword list, scroll down, change the level of a keyword far
down the list: the row shows the new level, the score and the message update, and the scroll position and focus are
the same as before the change.

**Acceptance Scenarios**:

1. **Given** the keyword list scrolled so its middle is on screen, **When** the person changes a keyword's level, **Then** that row shows the new level and "yours" marker, the score is recomputed, a confirmation is shown, and the page does not scroll.
2. **Given** a keyword, **When** the person presses Ignore, Restore, Reset or Remove, **Then** the row changes accordingly in place and the page does not scroll.
3. **Given** the Add keyword form, **When** the person adds a word, **Then** it appears in the list, the field is ready for the next word, the list count and score update, and the page does not scroll.
4. **Given** the keyboard, **When** the person uses a level control and the edit is saved, **Then** focus is still on the same control (or, when the row no longer has it, on the nearest sensible control) afterwards.
5. **Given** the edit is refused (a word already on the list, an empty or unusable word), **When** the person submits it, **Then** the refusal message is shown in place, nothing else on the page changes, and the page does not scroll.
6. **Given** several edits made in quick succession, **When** they are submitted one after another, **Then** each one is applied, in the order made, and the page ends up showing the result of the last.

---

### User Story 2 - The tailor page keeps my draft and stays live (Priority: P1)

On the tailor page the person is editing resume text that is not saved yet. A keyword edit must not touch that text,
the unsaved-changes bar or the edit cards they have applied, and the live score, highlighted posting text and
missing-keyword chips must reflect the new keyword levels at once.

**Why this priority**: On this page a reload is not just annoying: it re-boots the live editor, which is the thing the
person came to use.

**Independent Test**: On the tailor page, type a change in the resume text, then change a keyword's level: the typed
text is still there, the unsaved bar still shows, the ring shows the new live score, and the chips and highlights
match the new level.

**Acceptance Scenarios**:

1. **Given** unsaved changes in the resume text, **When** the person edits a keyword, **Then** the text, the cursor/selection, the unsaved bar and the applied-edit marks are unchanged.
2. **Given** a keyword edit that changes what counts as missing, **When** it is saved, **Then** the score ring, the posting highlights and the missing chips agree with the new keyword levels without another action.
3. **Given** the line that explains the score (its ceiling, the advice, whether it is ready to apply), **When** a keyword edit changes it, **Then** the line shows the new text.

---

### User Story 3 - It still works without scripts, and fails honestly (Priority: P2)

A browser that cannot or does not run the page's script keeps working as it does today: the edit is posted, the page
comes back with the message. When the in-place update cannot complete, the person is told rather than left with a
page that looks saved but is not.

**Why this priority**: The dashboard is server-rendered first; the enhancement must not become the only way in.

**Independent Test**: Disable scripts and edit a keyword (the old post-and-reload path works). With scripts on, stop
the server and edit a keyword: a visible message says the change could not be saved.

**Acceptance Scenarios**:

1. **Given** scripts are off, **When** the person edits a keyword, **Then** the page is posted and reloaded with the message exactly as before.
2. **Given** the server cannot be reached, **When** the person edits a keyword, **Then** the page shows a message that the change was not saved and leaves the controls usable again.
3. **Given** the server answers with a different page than the one being edited (for example the session ended), **When** the edit returns, **Then** the browser goes to that page instead of showing a half-updated one.
4. **Given** an edit is waiting for the server, **When** the person looks at the controls, **Then** they show that it is in progress and cannot be submitted twice.

---

### Edge Cases

- A keyword edit on a comparison that was deleted or replaced meanwhile: the usual "not found" or "predates" message appears; no half-updated list.
- An edit that changes nothing (same level chosen again): the message says so as it does today; the list is unchanged.
- The page is open in two tabs: each tab shows its own result; neither is wrong, and the stored state is the later edit.
- A keyword whose row disappears after the edit (Remove, or Ignore on a view that hides ignored ones): focus moves to a control still on the page, not to the top.
- The message area is empty before the first edit and must be able to appear without moving the content below it more than the message itself needs.
- Using the browser's Back button after several in-place edits leaves the page, as it would after any page that was not navigated.
- Text in another language, including the pseudo-language used to find untranslated English: the new message and the updated regions are fully translated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A keyword edit on the tailor page or on the Resume match tab — changing a level, Ignore, Restore, Reset, Remove, or Add — MUST update the keyword list, the score and the message without navigating, scrolling or reloading the page.
- **FR-002**: After an edit, keyboard focus MUST stay on the control the person used; when that control no longer exists, it MUST move to a control still in the list, never to the top of the page.
- **FR-003**: A refused or failed edit (the existing `err` and `warn` messages) MUST be shown in place with the same text it carries today.
- **FR-004**: On the tailor page, a keyword edit MUST NOT change the resume text in the editor, its selection, the unsaved-changes bar, or the applied and skipped marks on edit cards.
- **FR-005**: On the tailor page, after a keyword edit the live score, posting highlights and missing-keyword chips MUST reflect the new keyword levels.
- **FR-006**: The score and the lines that explain it (on the tailor page, the line with the ceiling, advice and readiness; on the match tab, the score badge and its change from the previous version) MUST show the values the edit produced.
- **FR-007**: Edits submitted while another is waiting MUST be applied one at a time, in the order made, and the controls of the waiting edit MUST be visibly busy and not submittable twice.
- **FR-008**: With scripts unavailable, every keyword form MUST keep working as a normal post followed by a page load with the message, as it does today. The server MUST answer every client the same way; no new endpoint or response shape is added.
- **FR-009**: When the in-place update cannot be completed because the server was unreachable, the page MUST say the change was not saved and make the controls usable again.
- **FR-010**: When the server's answer is not the page being edited, the browser MUST go to the page the server named.
- **FR-011**: Level controls that save when picked (the select that commits on a pointer pick or on Enter/blur by keyboard) MUST keep that behaviour on the updated list.
- **FR-012**: Every new person-visible word MUST be in the catalog and appear in the interface language, including the pseudo-language check.
- **FR-013**: The in-place update MUST be limited to the keyword controls; other forms on these pages (confirm-fact answers, Suggestions, apply-all, condense, save) keep their current behaviour.

### Key Entities

- **Keyword edit**: one change to a comparison's keyword list (level, ignore/restore/reset/remove, add) and the message it produces.
- **Updatable region**: a named part of the page (message area, keyword list and its count, score line) that is replaced as a whole after an edit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After any keyword edit, the page's scroll position is unchanged (0 px difference) on both pages.
- **SC-002**: Twenty keyword corrections in a row on the tailor page leave unsaved resume text intact every time (0 lost characters).
- **SC-003**: The updated score on screen equals the score a full page load would show after the same edit, for every edit kind.
- **SC-004**: With scripts off, 100% of keyword edits still complete and show their message.
- **SC-005**: An edit that cannot reach the server is reported to the person within 10 seconds; none is silently dropped.

## Assumptions

- The flash banner at the top is a symptom, not the cause; turning it into a toast is tracked separately and is out of scope here.
- One extra render of the page per edit is acceptable, because it keeps a single server path for every client.
- The confirm-fact answers, the Suggestions block, apply-all, condense and save forms hold their own client state and are not part of this change.
- The Resume match tab has no live editor, so only the list, the score and the message update there.
- The message about an unreachable server may use the same message area as the server's own messages.
