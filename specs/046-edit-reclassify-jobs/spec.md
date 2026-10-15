# Feature Specification: Edit a job's details and re-classify it

**Feature Branch**: `issue-46-edit-reclassify-jobs`

**Created**: 2026-10-15

**Status**: Draft

**Input**: GitHub issue #46 — "allow editing and reclassifying of jobs. Use case: some Gmail-imported jobs don't have enough context."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add the missing context to a posting and get a fair verdict (Priority: P1)

A person opens a posting that came from their Gmail label, or one they pasted. The mail gave little: the description is a couple of lines, the company is not named, the location is missing. The score is poor for that reason. They press **Edit**, fill in what they know (title, company, location, description), save, and the posting is scored again against their searches on the strength of the new text.

**Why this priority**: This is the whole request. Without it a thin posting stays thin and its verdict stays unreliable.

**Independent Test**: Open a Gmail-imported posting with a one-line description, edit the description and location, save, and see the new text on the page and a freshly formed verdict.

**Acceptance Scenarios**:

1. **Given** a posting only this person holds, **When** they save a new title, company, location and description, **Then** the page shows the new values and the posting is re-scored against all of their running searches.
2. **Given** the same posting, **When** they change only the location, **Then** the place facets shown under the location (workplace, countries, regions) follow the new text.
3. **Given** a posting the person has marked Applied or Saved, **When** they edit it and the re-score rejects it, **Then** its status is unchanged — an edit never dismisses a posting.
4. **Given** no search can score the posting (none running, or the engine does not answer), **When** they save, **Then** the edit is kept and the page says no new verdict was formed.

---

### User Story 2 - Undo a description edit (Priority: P2)

A person replaced a description and the new text turns out wrong or worse. They use **Restore the original** and the text the posting arrived with comes back, with a fresh score.

**Why this priority**: Makes editing safe to try; the existing restore already covers it once description edits keep the original.

**Independent Test**: Edit a description, press Restore the original, see the first text back and the page note that it was restored.

**Acceptance Scenarios**:

1. **Given** a posting whose description was edited, **When** the person restores the original, **Then** the text from before the first edit returns and the posting is re-scored.
2. **Given** a description edited twice, **When** they restore, **Then** the text the posting first arrived with returns, not the intermediate edit.

---

### User Story 3 - A shared posting cannot be changed under other people (Priority: P2)

Postings from boards and aggregators are held by everyone they reach. One person editing such a posting would change what others see and how they are scored. Such a posting is therefore not editable; the person is told why and can still re-classify it.

**Why this priority**: Protects other people's data in a multi-person install.

**Independent Test**: With two people holding the same posting, one tries to open or submit the edit; it is refused with an explanation and nothing changes.

**Acceptance Scenarios**:

1. **Given** a posting also held by another person, **When** the person opens it, **Then** no Edit control is offered.
2. **Given** the same posting, **When** an edit is submitted directly, **Then** it is refused and no field changes.
3. **Given** a posting this person does not hold at all, **When** they try to edit it, **Then** it is "not found", as for every job page.

### Edge Cases

- Title or description left empty on save: refused with a message; nothing is stored.
- Description shorter or longer than the limits already used for pasted/refreshed descriptions: refused with the same wording rules.
- Nothing actually changed on save: no re-score is spent; the page says nothing changed.
- Company cleared: the posting reads as any posting of its source with no named employer does — "Company not named" for a mail, import or folder row, never a source's name borrowed in its place; a pasted posting, whose source is its employer, shows that name again.
- Description length limits apply only when the description itself was changed; fixing a location on a short description is not blocked by it.
- Another person is given a row for the posting between opening the form and saving: the save is refused by the same rule as above.
- A posting in a folder of saved files or an import: editable like a Gmail one if only this person holds it.
- Salary, URL, source and status are not part of the form.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A person MUST be able to edit a posting's title, company, location and description from its page.
- **FR-002**: Editing MUST be offered and accepted only when the person is the only one holding the posting; otherwise it MUST be refused with an explanation and change nothing.
- **FR-003**: A description change MUST keep the text the posting arrived with, and "Restore the original" MUST bring it back, including after several edits.
- **FR-004**: A location change MUST refresh the posting's place facets (workplace, countries, regions) from the new text.
- **FR-005**: Saving a change MUST re-score the posting against the person's running searches, and MUST NOT change its status because of that re-score.
- **FR-006**: Title and description MUST NOT be saved empty; description length MUST respect the same minimum and maximum as other description changes; a refused save MUST keep what the person typed and say why.
- **FR-007**: A save that changes nothing MUST NOT trigger a re-score and MUST say so.
- **FR-008**: Stored comparisons and keyword work built on the old text MUST NOT be reused after a description change.
- **FR-009**: Every word the person reads for this feature MUST exist in every interface language the product ships.
- **FR-010**: The edit MUST NOT touch the posting's link, source, salary or status.

### Key Entities

- **Posting**: the shared job record (title, company as the employer names it, location and its place facets, description, the description it arrived with, when it was last replaced).
- **Holder**: a person with their own row for a posting (status, verdict, notes). A posting with exactly one holder is that person's to edit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can correct a thin posting and see its new verdict in one visit, with no more than one form submission.
- **SC-002**: 100% of description edits can be undone to the text the posting arrived with.
- **SC-003**: 0 edits to a posting held by more than one person succeed.
- **SC-004**: 0 postings change status as a side effect of an edit.
- **SC-005**: Every new message appears in all shipped interface languages.

## Assumptions

- A Gmail-imported, pasted, imported or folder-saved posting has one holder, so the single-holder rule covers the stated use case without a separate "owner" notion.
- An administrator gets no special right to edit a posting that other people hold.
- Re-scoring uses the same path as the existing Re-classify button; it may fail when no engine answers, and that is reported, not fatal.
- Out of scope: editing link, source, salary, status; editing shared board/aggregator postings; bulk editing.
