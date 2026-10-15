# Contract: the text a Reactive Resume export is written to

Internal contract between `readReactiveResume` (producer) and everything that reads a stored resume's text (`structureFromText` and the page's "what a parser reads" panel, the scan, the comparison, the render's fallback, "Download original"). It is the dialect a `.docx` or `.pdf` extracts to, so the shared reader needs no change. Changed from `specs/039-reactive-resume-import`: the `#` / `###` / `####` lines, the `## Profiles` section, and the dropped contact links.

## Header (the first three lines, no `#`)

```text
<name>
<headline>
<email> · <phone> · <place> · <website> · <contact field> … · <profile> · <profile>
```

- The contact line holds only the entries the export has; none is padded. A contact field with a link is that link, without one its words; a profile with an address is the address, else `Network: username`.
- A blank line follows the header, then the sections.

## Sections

`## <title>` — the section's own title in Reactive Resume — then its lines.

| Section | Lines |
|---------|-------|
| Summary | the paragraphs, as before |
| Experience | per job (per position when an employer holds several): `<Company>` or `<Company> · <Place>`, then `<Position> · <Dates>` (just `<Dates>` with no position), then the description's lines, `- ` for list items; nothing at all above the text when the item names neither company nor position |
| Education | one line: `<School> · <Degree> in <Area> · <Place> · <Dates>` (parts that exist), then `Grade <grade>` joined onto the line, then the description's lines |
| Skills | `<Group>: <keyword>, <keyword>` per group, as before |
| Languages | `<Language> (<fluency>)`, or `<Language>` |
| Certifications, awards, publications | `<Title> — <Issuer> · <Date>` then the description's lines |
| Volunteer | `<Organisation> · <Place> · <Dates>`, `<Position>`, the description's lines |
| Projects | `<Name> · <Dates>`, the description's lines, `Keywords: …`, the link |
| References | `<Name> — <Position>`, the description's lines |
| Interests, custom sections | as before |

No imported line begins with `#` except a `## ` section heading.

## Formatted text

| Source HTML | Written as |
|-------------|------------|
| `<a href="https://x.example/p">the post</a>` | `the post (https://x.example/p)` |
| `<a href="https://x.example/p">https://x.example/p</a>` | `https://x.example/p` |
| `<a href="https://x.example/p"></a>` | `https://x.example/p` |
| `<a href="mailto:a@b.example">write</a>` | `write (mailto:a@b.example)` |
| `<a href="javascript:alert(1)">click</a>` | `click` |
| `<a>no target</a>` | `no target` |

Everything else in formatted text is read as before (paragraphs, lists, entities).

## Not changed

Section order, date formats, the `.md` file name and type (`markdownResume`), the words of every field, and every other upload kind.
