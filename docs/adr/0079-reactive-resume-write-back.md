# 0079 — A tailored copy goes back to Reactive Resume as a new resume

**Status:** Accepted (2026-10-17). Issue #50. Builds on [0073](./0073-reactive-resume-import-reads-a-file-or-asks-the-owners-instance.md) (the import and
its reader), [0075](./0075-reactive-resume-connection-is-a-saved-setting.md) (the saved connection and the one
key accessor) and [0077](./0077-tailored-resume-copies.md) (the copy that is sent).

## Context

A resume pulled from Reactive Resume is flattened to Markdown and forgets where it came from. The integration
was read-only (`reactive-resume-api.ts` made two GETs), so the wording written for a posting lived only in a
downloaded document, and the person redid it by hand in the tool where the resume is actually designed.

The export shapes had been written from the published schema; the write API had never been called. On
2026-10-16 the person's own instance (Reactive Resume 6.0.3) was read: `GET /api/openapi/resumes/{id}` answers
`{ id, name, slug, isLocked, updatedAt, data, … }`, the items carry ids (`e1`, `sk1`), and the descriptions are
HTML (`<p>`, `<ul><li><p>`, `<strong>`). The published spec documents `POST /resumes/{id}/duplicate`,
`PATCH /resumes/{id}` (RFC 6902 operations, `expectedUpdatedAt`) and says a mutation must not be retried after a
timeout.

## Decision

- **The resume remembers its source.** `Resume.remoteId` and `Resume.remoteGeneration` (`v4`/`v5`/`v6`),
  both set or both `NULL`, written with the text and never apart from it: `createResume` and
  `replaceResumeFile` take an `origin` and **clear it when the new text has none**, so a file upload, a promoted
  copy or a saved text version cannot keep an origin its text no longer matches. A pull whose text equals the
  stored one records the origin without a new version (`attachResumeOrigin`), which is how a resume imported
  before this change gets one. No backfill.
- **The JSON is not stored.** At send time the source is read again and read with `readReactiveResumeMapped`,
  which gives the same Markdown as `readReactiveResume` plus, per line, the field it came from (a JSON Pointer, the
  item's id, a kind: rich text, plain, keyword list). The send is refused as *stale* when that Markdown differs from
  `Resume.text`. A stored copy would go stale and would be a second copy of personal data.
- **A NEW resume, made by the instance.** `POST /resumes/{id}/duplicate` carries layout, template, colours,
  section order and hidden items without ApplyPack understanding any of them; the edits are applied to the
  copy with `PATCH` and `expectedUpdatedAt`. The original is only read. The name is
  `<Resume> - <Company> - <Role>`.
- **Only words inside a field are changed** (`reactive-resume-apply.ts`, pure). An edit is what the shared line
  diff says (the .docx patcher's), placed by the line's source. A rich-text field is changed block by block: a
  paragraph or list item nobody touched keeps its markup byte for byte; a reworded one becomes its new words
  (inline formatting in *that* block is lost); an added bullet is a new list item beside its neighbour; a removed
  one is removed. Before an operation is emitted the new HTML is read back with the reader's own rules and must give
  exactly the lines the edits describe, else the field is left alone (*misaligned*).
- **What it will not guess is reported, not dropped.** A line made of several fields (name, contact, a company
  or `Position · Dates` line), a heading or new section, a skills group renamed, a line with no known place: each is
  listed as *not applied* with its reason. A heading that differs only in case is the renderer's capitals, not an
  edit. When edits exist and none can be placed nothing is created (*nothingApplied*).
- **One request each, never repeated.** The client is the only file that calls the instance; a mutation that
  times out may have happened, so nothing is retried. A failure after the copy exists names the copy on the result
  page, because it is still on the instance; ApplyPack does not delete it.
- **Only v6 is written** (the only generation whose write path was checked). Older generations still import and
  read; a send is declined with the reason.
- **The result is a page, not a flash.** The POST renders the outcome itself: the cookie cannot carry a per-edit
  report or a link.

## Alternatives considered

- **Store the raw JSON (the issue's first option) or a per-item id map.** Both go stale, hold a second copy of
  the person's data, and need a migration path; re-reading is exact about staleness and costs one GET.
- **`POST /resumes` + `PUT data` from ApplyPack's own copy.** Needs the whole JSON in hand and risks dropping
  fields it does not know; duplicate-and-patch cannot.
- **Regenerate the field's HTML from the text.** Loses all inline formatting everywhere; block-level edits lose it
  only in a block the person reworded.
- **A model decides where an edit goes.** Non-deterministic, and a rule a person can lose data to belongs in code.
- **Write to the original.** Out of scope on purpose: an unreviewed write to the person's real resume.

## Consequences

- One new pair of nullable columns; the reader gains a second entry point and keeps its output byte for byte.
- A send makes up to four requests (read, copy, read the copy, patch) and creates a resume the person may end up
  with twice if they press again; the instance makes the address unique and the page does not hide it.
- A reworded bullet loses its inline links and bold; an untouched one keeps them.
- The copy's text is the saved document read back, which draws headings in capitals: that is why case-only heading
  changes are ignored. Other differences between a clean document and its Markdown would show as edits.
- Reading is unchanged for v4/v5; writing them would need the same two calls checked against such an instance.
