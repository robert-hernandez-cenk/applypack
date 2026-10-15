# Data Model: Keep profile and page links when importing from Reactive Resume

No stored data changes: no table, column, migration or setting. The module reads an export that arrives as untrusted JSON (`unknown`, guarded by `isRec` / `list` / `text`) and returns text.

## Input (read, never written)

| Name | Where it lives per generation | Used for |
|------|-------------------------------|----------|
| Profile item | `sections.profiles.items[]` (all three) | header entry |
| Profile network | `network` | label of a username-only entry |
| Profile username | `username` | username-only entry |
| Profile address | `website` / `url` as a string, or `{ url }` / `{ href }` | the bare address |
| Hidden | `hidden === true` or `visible === false`, on the item or on `sections.profiles` | skipped |
| Formatted text | `description`, `summary`, `content` HTML | scanned for anchors |

## Output

`ReactiveResumeRead` is unchanged: `{ ok: true, generation, name, markdown } | { ok: false, code }`. Only the `markdown` text differs; its shape is in [contracts/imported-markdown.md](./contracts/imported-markdown.md).

## Rules (from the spec)

- Entry order: email, phone, location, website, custom fields, then profiles in the export's order (FR-001).
- Entry text: address if there is one; else `Network: username`; else nothing (FR-002, FR-003, Edge Cases).
- Exact-text de-duplication across the whole line (FR-006).
- Link target kept only for `http`, `https`, `mailto` (FR-008).
- Resume with no profiles and no anchors: byte-identical output to before (FR-011).
