# Contract: the Markdown a Reactive Resume export is written to

Internal contract between `readReactiveResume` (producer) and everything that reads a stored resume's text (the structure step, the scan, the comparison, "Download original"). Only the parts this feature changes are listed; the rest is as in `specs/039-reactive-resume-import`.

## Header

```text
# <name>
<headline>
<email> · <phone> · <location> · <website> · <custom field> … · <profile> · <profile>
```

- The third line holds only the entries the export has; none is padded.
- A `<profile>` is the bare address (`https://github.com/arivera`), or `Network: username` when the export gave no address.
- No `## Profiles` section follows anywhere in the document.

## Formatted text

| Source HTML | Written as |
|-------------|------------|
| `<a href="https://x.example/p">the post</a>` | `the post (https://x.example/p)` |
| `<a href="https://x.example/p">https://x.example/p</a>` | `https://x.example/p` |
| `<a href="https://x.example/p"></a>` | `https://x.example/p` |
| `<a href="mailto:a@b.example">write</a>` | `write (mailto:a@b.example)` |
| `<a href="javascript:alert(1)">click</a>` | `click` |
| `<a>no target</a>` | `no target` |

Everything else in formatted text is read exactly as before (paragraphs, lists, entities).

## Not changed

Heading levels, section order, date formats, the `.md` file name and type (`markdownResume`), and every other upload kind.
