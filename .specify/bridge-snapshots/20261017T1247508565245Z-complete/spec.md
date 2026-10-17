# Feature Specification: Result messages as toasts

**Feature Branch**: `issue-54-toast-flash-messages`

**Created**: 2026-10-17

**Status**: Draft

**Input**: GitHub issue #54 — "Show flash messages as a toast popup instead of a top banner".

## User Scenarios & Testing *(mandatory)*

After most actions the page says what happened: `"prototype development" is now preferred — score stays 83, no AI call.`,
"Saved", "Could not reach the board". That message is a banner at the top of the page. It pushes the content down by
its own height, and when the person has scrolled it sits above the viewport, so the result of what they just did can
go unseen. Edits that save without reloading the page (#53) make this worse: the page stays scrolled where it was, and
the message appears somewhere off screen.

After this change the message is a small popup that appears in a fixed corner of the screen, wherever the page is
scrolled, and leaves by itself or by hand. It is the same message, produced the same way; only where and how it shows
changes. This applies to every page that shows such a message, starting with the tailor page and the job's Resume
match tab.

### User Story 1 - See the result of what I just did (Priority: P1)

A person scrolled far down a page presses a button or saves an edit. The result message appears in a fixed spot in the
corner of the screen, over the page, without moving any of the page's content. A success message goes away on its own
after a few seconds. The person can close any message earlier.

**Why this priority**: This is the whole issue; the other stories protect it.

**Independent Test**: On a page with enough content to scroll, scroll to the bottom, make an edit that produces a
success message: the message is visible on screen at once, nothing on the page shifts, and it is gone a few seconds
later without any action.

**Acceptance Scenarios**:

1. **Given** a page scrolled away from its top, **When** an action produces a success message, **Then** the message is visible in the fixed corner of the screen and the page's content did not move.
2. **Given** a success message on screen, **When** a few seconds pass with no interaction, **Then** it disappears.
3. **Given** any message on screen, **When** the person presses its close control (or Escape), **Then** it disappears at once.
4. **Given** a message on a narrow phone screen, **When** it appears, **Then** it fits the screen width with an even margin and does not cover the page's header buttons.
5. **Given** the light or the dark look, **When** a message appears over page content, **Then** its text is fully readable against what is behind it.

---

### User Story 2 - Problems and choices do not vanish (Priority: P1)

A warning or an error stays on screen until the person closes it, so a failure is never missed by looking away for a
moment. A message that offers something to do — "Re-run anyway", "Tailor resume →", "Download .docx" — also stays,
because a button that disappears while the person reaches for it is worse than no button.

**Why this priority**: Auto-dismissing a failure or a choice would make the change a regression for exactly the cases
that matter most.

**Independent Test**: Trigger an error, a warning, and a message with an action; wait one minute: all three are still
there. Close each: it goes.

**Acceptance Scenarios**:

1. **Given** an error or warning message, **When** any amount of time passes, **Then** it stays until closed.
2. **Given** a message that carries an action, **When** any amount of time passes, **Then** it stays until closed, and the action works.
3. **Given** a success message about to close by itself, **When** the pointer rests on it or keyboard focus is inside it, **Then** it does not close until the pointer leaves and focus moves away.
4. **Given** a long success message, **When** it appears, **Then** it stays on screen long enough to read (longer than a short one).
5. **Given** a message tied to a form field the system refused, **When** it appears, **Then** the field is still marked invalid and described by the message, and the message stays.

---

### User Story 3 - Everyone is told, and nobody is forced to watch motion (Priority: P2)

A person using a screen reader hears the message once when it appears: errors interrupt, other messages wait their
turn. A person who asked their system for less motion sees the message appear and leave without sliding or fading.
The close control is reachable and usable by keyboard and does not take focus away from what the person was doing.

**Why this priority**: Required for the change to be accessible, but the feature is already useful without it.

**Independent Test**: With a screen reader on, trigger a success message and an error: each is spoken once, the error assertively. With reduced motion on, neither animates. Tab to the close control and press Enter: the message closes and focus is not lost to the top of the page.

**Acceptance Scenarios**:

1. **Given** an error message, **When** it appears, **Then** assistive technology announces it assertively; a success or warning message is announced politely; neither is announced twice.
2. **Given** reduced motion requested, **When** a message appears or leaves, **Then** there is no movement or fade.
3. **Given** a message appears while the person is typing in a field, **When** it shows, **Then** keyboard focus stays where it was.

---

### User Story 4 - It works without scripts and with edits in place (Priority: P2)

Where scripts do not run, the message still shows, as the banner at the top of the page it is today. Where a form
saves in place without leaving the page (the keyword edits of #53), the message of each save appears as a popup, and a
failed save shows the "not saved" message the same way.

**Why this priority**: Keeps the feature from breaking the pages that work without scripts and completes #53's flow.

**Independent Test**: Turn scripts off and trigger a message: it appears as the top banner, as before. Turn them on, change a keyword on the tailor page: the message appears in the corner and the page does not move.

**Acceptance Scenarios**:

1. **Given** scripts do not run, **When** an action produces a message, **Then** the message is shown as the banner at the top of the page.
2. **Given** a keyword edit saved in place, **When** it succeeds, **Then** its message appears as a popup; **When** it fails, **Then** a "not saved" error popup appears that stays until closed.
3. **Given** two edits saved one after the other, **When** the second finishes, **Then** only the second message is on screen.

---

### Edge Cases

- A message arrives while another is still showing: it replaces the earlier one; there is one message area, not a stack.
- A message appears on a page that lets the person scroll inside a pane: it stays fixed to the screen, not to the pane.
- The person closes a message and reloads: it does not come back (it was shown once).
- A very long message (a refusal that quotes a value): it wraps and stays within the screen, scrolling inside itself if needed, and never exceeds the screen height.
- A message is shown in a language other than English, including the long-text test language: the close control's label is in that language and nothing English is left over.
- The person navigates away while a message is open: the next page shows only its own message.
- A page has no message: nothing is drawn, and the page's layout is the same as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A result message MUST appear in a fixed place in the viewport (a corner on wide screens, the bottom edge with even margins on narrow ones), visible whatever the page's scroll position, and MUST NOT change the position of any page content.
- **FR-002**: The change MUST apply to every page that shows a result message, through the one shared message component, without per-page changes to how messages are produced.
- **FR-003**: A success message MUST close by itself after a few seconds; the time MUST be longer for longer text, and MUST be suspended while the pointer is over the message or focus is inside it.
- **FR-004**: Warnings, errors, and any message carrying an action or a download MUST stay until closed.
- **FR-005**: Every message MUST be closable by hand, by a close control reachable by keyboard and labelled in the page's language, and by the Escape key.
- **FR-006**: Errors MUST be announced assertively and other messages politely, each exactly once; the message MUST NOT take keyboard focus.
- **FR-007**: Appearing and leaving MUST NOT animate when the person has asked for reduced motion.
- **FR-008**: Where scripts do not run, the message MUST be shown as the banner at the top of the page, with the same text, tone and actions as today.
- **FR-009**: A message saved-in-place (#53) and the "not saved" failure message MUST use the same popup behaviour; a newer message replaces an older one.
- **FR-010**: A message tied to a refused form field MUST keep marking that field invalid and described by the message.
- **FR-011**: The popup MUST be readable (text contrast meets the dashboard's existing standard) over any page content in both the light and the dark look, and MUST stay within the screen width and height.
- **FR-012**: The close control's label MUST come from the translation catalog in every shipped language; no English may remain on a page in the long-text test language.
- **FR-013**: How a message is produced, carried across the redirect, and worded MUST NOT change.

### Key Entities

- **Result message**: one per page load or in-place save. Has a tone (success, warning, error), text, and optionally one action (a button/form, a link to continue, a download) and a refused-field marker. Shown once.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After any action that produces a message, the message is fully visible on screen at every scroll position on every page, and the page's content shifts by 0 px when it appears or leaves.
- **SC-002**: A success message leaves by itself within 12 seconds of appearing and never sooner than 4 seconds; warnings, errors and messages with an action remain after 60 seconds.
- **SC-003**: With scripts disabled, 100% of messages still show, as the top banner, with their actions working.
- **SC-004**: Each message is announced exactly once by a screen reader; an error is announced assertively.
- **SC-005**: With reduced motion requested, a message appears and leaves with no animation.
- **SC-006**: The close control can be used by keyboard alone, and the page's focus does not move when a message appears.
- **SC-007**: Every page of the dashboard, in every shipped language and the long-text test language, still renders without untranslated text and without a server error.

## Assumptions

- "A few seconds" is about 6 seconds for a short success message, growing with length, capped at 12 seconds.
- The popup sits at the bottom of the screen rather than the top so that it does not cover the header buttons that most often cause a message.
- There is one message area per page; messages do not queue or stack, and there is no history of past messages.
- Standing page notices (a warning that is true on every render) and status lines inside cards are not result messages and are not changed.
- Pages needing the person's attention to a refused field keep the existing field marking; this feature only moves where the message shows.
- Scripts are required only for the popup behaviour; the no-script banner is the fallback and needs no detection.
