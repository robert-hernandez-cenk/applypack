# Feature Specification: Dark theme for the dashboard

**Feature Branch**: `issue-4-dark-theme`

**Created**: 2026-10-12

**Status**: Draft

**Input**: GitHub issue #4 — "Dark Theme": "The light theme is burning my eyes." The dashboard has only a light look. People who use it in a dim room, or whose system is set to dark, get a bright page with no way to change it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The dashboard follows my system's dark setting (Priority: P1)

A person whose operating system or browser prefers a dark appearance opens any dashboard page. The page is dark from the first paint: dark surfaces, light text, and the same layout and meaning as before.

**Why this priority**: This is the complaint in the issue. With no choice made, most people get relief just by having the system setting honoured.

**Independent Test**: Set the system to dark, clear any stored choice, open the Overview, a job and Settings. All three render dark with no visible flash of the light look.

**Acceptance Scenarios**:

1. **Given** the system prefers dark and no choice has been made, **When** any page loads, **Then** it renders in the dark look from the first paint.
2. **Given** the system prefers light and no choice has been made, **When** any page loads, **Then** it renders in the light look, unchanged from today.
3. **Given** the system setting changes while a page is open and no choice has been made, **When** the change happens, **Then** the page follows it without a reload.

---

### User Story 2 - I choose Light, Dark or System myself (Priority: P1)

A person who wants the dashboard dark even though their system is light (or the reverse) switches the appearance from the interface. The choice is System, Light or Dark; System is the default. The choice sticks across pages and visits in that browser.

**Why this priority**: The system setting alone cannot serve someone whose system is light but whose room is dark; the user asked for this switch explicitly.

**Independent Test**: With the system on light, choose Dark; the page turns dark and stays dark on the next page and after closing and reopening the browser. Choose System; it follows the system again.

**Acceptance Scenarios**:

1. **Given** any page, **When** the person picks Dark, **Then** the page is dark and every other page they open is dark too.
2. **Given** the person picked Light while the system prefers dark, **When** pages load, **Then** they stay light.
3. **Given** the person picked System, **When** pages load, **Then** the system setting decides.
4. **Given** a choice was made, **When** the person returns later in the same browser, **Then** the choice is still in force and the first paint already shows it.
5. **Given** the switch is used, **When** it completes, **Then** the person lands back on the page they were on.

---

### User Story 3 - Everything stays readable and keeps its meaning (Priority: P2)

In the dark look every piece of text is as readable as in the light look, and colour still carries the same meaning: success, warning, danger, information, the accent and the selected row look like what they are. Charts, status pills, buttons, form controls, the embedded document preview and the application's icon all fit the dark look.

**Why this priority**: A dark page with unreadable text or lost status colours is worse than the light one.

**Independent Test**: Open every page in the dark look and check that no text sits on a surface it cannot be read on, no light-only box glares against the dark page, and status tones are still told apart.

**Acceptance Scenarios**:

1. **Given** the dark look, **When** any text colour is shown on any surface it can appear on, **Then** it meets the same accessibility contrast standard (WCAG AA) the light look is held to.
2. **Given** the dark look, **When** a page shows a status pill, a chart, a button, a form control or a shadow, **Then** it reads clearly against the dark surfaces and nothing is left in light-only colours.
3. **Given** the dark look, **When** a document preview of a resume or posting is shown, **Then** the document itself stays a white page, as a printed page would be, inside the dark frame.

---

### Edge Cases

- A browser with cookies blocked: the switch cannot remember, and the page falls back to the System setting.
- A stored choice with an unknown value is ignored and treated as System.
- The switch used from a different site (cross-origin request) is refused, like every other change in the dashboard.
- The switch reached without a page to return to sends the person to the Overview.
- Pages printed or exported (PDF resumes, CSV) are not affected by the chosen appearance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST offer three appearances: System (default), Light and Dark.
- **FR-002**: With System, the page MUST follow the person's system or browser dark/light preference, including a change while the page is open.
- **FR-003**: The chosen appearance MUST be applied in the first paint of every page, with no visible flash of the other look.
- **FR-004**: The choice MUST persist across pages and visits in the same browser without any change to stored application data.
- **FR-005**: The person MUST be able to change the choice from the interface, from any page, and return to the page they were on.
- **FR-006**: Changing the choice MUST be refused when it comes from another site.
- **FR-007**: The dark look MUST be a second set of values for the existing colour roles (surface, line, ink, accent and status tones); no page or component is restyled one by one.
- **FR-008**: Every text colour MUST meet WCAG AA contrast on every surface it can sit on in the dark look, verified by an automated test as the light look is.
- **FR-009**: Status pills, charts, shadows, focus rings, selection and scrollbars MUST have dark-appropriate values, and the status tones MUST remain distinguishable from each other.
- **FR-010**: The white-on-accent text of primary buttons and the application icon MUST stay legible in both looks.
- **FR-011**: The document preview MUST keep showing the document on a white page in both looks.
- **FR-012**: Every new word the person reads MUST be available in all interface languages the application ships.
- **FR-013**: The design guidance MUST be updated to say the dark look exists and how it is defined.

### Key Entities

- **Appearance choice**: one of System, Light, Dark; held per browser, defaults to System; an unknown value counts as System.
- **Colour role set**: the named colours every page styles through; there is one set for the light look and one for the dark look, with the same names.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the system set to dark and no choice made, 100% of dashboard pages render dark with no light flash on load.
- **SC-002**: A person can switch appearance in at most 2 interactions from any page and the choice is still in force on the next visit.
- **SC-003**: 100% of text/surface pairs in the dark look pass WCAG AA contrast, checked automatically.
- **SC-004**: No dashboard page shows a light-only box or unreadable element in the dark look, confirmed by viewing every page at desktop and phone width.
- **SC-005**: The light look is visually unchanged for anyone who does not use the dark look.

## Assumptions

- The preference is per browser, not per person or account; storing it with the person's data is out of scope.
- Printed and exported output (PDF resumes, CSV, the marketing site) keeps its own look and is out of scope.
- No component is redesigned; the dark look is the existing design with different colour values.
- The switch sits in the dashboard's persistent chrome (the sidebar) and/or Settings; its exact placement is a planning decision.
