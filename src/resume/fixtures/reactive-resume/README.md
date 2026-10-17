# Reactive Resume fixtures

Hand-written from the published schema (https://docs.rxresu.me/guides/json-resume-schema.md) for v6 and from the v4 file layout; v5 is inferred. **Not verified against a real export or a live instance.** People and employers are invented.

`v6-live-shape.json` is the exception in one respect: its **shape** (not its data) was read off a real v6 export on 2026-10-15 — contact links kept in `basics.customFields[].link` with `profiles` empty, a website with a label and no address, six experience items with `period` and `dates` and `<p>Team</p><ul>…</ul>` descriptions (some with a bold sub-role paragraph), three same-school education items with single-year dates, ten skills groups, every other section hidden and empty. Every name, employer, address and link in it is invented.

`v6-live-response.json` is the whole `GET /api/openapi/resumes/{id}` answer of a real Reactive Resume 6.0.3 instance (read 2026-10-16, #50): the envelope (`id`, `slug`, `isLocked`, `updatedAt`, …) around `data`, with the real `metadata` (template, layout, typography), item ids (`e1`…, `sk1`…), `dates`, `period`, HTML descriptions with `<strong>` and nested lists. Only the **words** were replaced (placeholder text of the same length, `Example Org N`, `person@example.com`); the structure is the live one. Regenerate by redaction, never by committing the real response.
