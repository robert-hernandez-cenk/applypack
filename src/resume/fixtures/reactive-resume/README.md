# Reactive Resume fixtures

Hand-written from the published schema (https://docs.rxresu.me/guides/json-resume-schema.md) for v6 and from the v4 file layout; v5 is inferred. **Not verified against a real export or a live instance.** People and employers are invented.

`v6-live-shape.json` is the exception in one respect: its **shape** (not its data) was read off a real v6 export on 2026-10-15 — contact links kept in `basics.customFields[].link` with `profiles` empty, a website with a label and no address, six experience items with `period` and `dates` and `<p>Team</p><ul>…</ul>` descriptions (some with a bold sub-role paragraph), three same-school education items with single-year dates, ten skills groups, every other section hidden and empty. Every name, employer, address and link in it is invented.
