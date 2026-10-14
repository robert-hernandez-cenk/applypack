# 0073 — A Reactive Resume resume is read from its export file or from the owner's own instance

**Status:** Accepted (2026-10-14). Issue #39. Builds on [0005](./0005-no-linkedin-indeed-workday.md)
(nothing is scraped; this reads the person's own resume with their own key), [0011](./0011-pdf-extraction-via-unpdf.md)
(an upload becomes text) and [0070](./0070-administrators-run-the-install-members-work-in-their-own-space.md)
(administrators and members).

## Context

People keep resumes in Reactive Resume, hosted (rxresu.me) or self-hosted, and had to export a PDF or
Word file to use them here. Its JSON export carries more than that file shows — every item with its
dates and its hidden flag — and the three generations (v4, v5, v6) differ in shape and carry no version
marker. A self-hosted instance also answers an API with the owner's key.

## Decision

- **The stored form is Markdown.** A pure module (`resume/reactive-resume.ts`) reads the three shapes,
  told apart by their layout, and writes the visible content in reading order: hidden sections and
  items out, design, picture and template ignored, formatted text flattened through `stripHtml` once.
  `Resume.text` and `Resume.original` are that Markdown (`<name>.md`, `text/markdown`), so the scan, the
  structure reader and every comparison need no change. The raw JSON is not kept.
- **`.json` is read inside `readResumeUpload`**, not added to `ACCEPTED_EXTENSIONS`, because that list
  also gates screening intake and the applicant folders, where a JSON file must stay refused.
- **A live pull asks the instance with the person's API key.** `POST /resumes/reactive/list` takes the
  address and the key, calls `GET {base}/api/openapi/resumes` with `x-api-key`, and shows the person's
  resumes; `POST /resumes/reactive/import` fetches the chosen one and converts it as a file would be. v4
  has no such API; it goes through the file.
- **The key lives in memory for ten minutes.** Between listing and picking it sits in `src/web/pull-stash.ts`
  (per person, a handful of entries, taken once); no page, link, log line, flash or error carries it.
  The instance address is not remembered either.
- **The request is bounded.** http(s) only, no credentials in the address, redirects refused rather
  than followed, ten seconds, five megabytes, no other header.
- **Members cannot aim the server inward.** For a member, an address that is private, loopback or
  link-local, or a name that resolves to one, is refused before any request (the same predicates as
  the posting-URL guard, `jobs/posting-url.ts`). Only administrators may reach them (the one person of a local install is one) —
  a self-hosted instance usually lives there.

## Considered and rejected

- **File only.** Safe and enough, but the person asked for a pull against their instance.
- **Block private addresses for everyone.** Rules out the self-hosted case the feature is for.
- **Administrators only.** Members keep resumes too; the address rule is the actual risk.
- **Keep the key to make "refresh from Reactive Resume" one click.** A stored credential for a feature
  that is a one-time import; revisit if sync is ever wanted.
- **JSON Resume as the stored form.** Text is the source of truth (ADR 0039).

## Consequences

- The shapes are written from the published schema and the v4 file layout and have **not been checked
  against a live instance**; the readers are tolerant (unknown keys ignored, missing ones empty) and the
  fixtures say so. A real export may show differences.
- A name whose DNS answer changes between the check and the connection (rebinding) is not pinned, as in
  the posting-URL fetcher; the risk is accepted for the member case.
- A member on a shared install with a self-hosted instance on a private address cannot use the pull and
  uses the file.
