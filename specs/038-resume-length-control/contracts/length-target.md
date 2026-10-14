# Contract: page target (#38)

## Form (`POST /target`)
- Field `pages`: `keep` (default) | `1` | `2` | `3`. Unknown or missing → `keep`.
- Present on both job modes (`existing`, `new`).

## Stored marker
- `ResumeMatch.breakdown.pages`: `"keep" | 1 | 2 | 3`. Missing → `keep`.

## Prompt block (only when target ≠ keep, only in `full` match and in suggestions)
Rendered by `lengthLines(plan)` in the user message, outside any fence (our own instruction):
- states the target pages, the resume's estimated pages and the overshoot;
- orders cuts by least relevance to this posting, older roles condensed to a line or two, strongest evidence for the must-haves kept;
- states the removals cap for this run (overrides the default ~8);
- repeats nothing that the gate decides: contact details and wanted keywords stay protected in code.
When the plan is already met, `lengthLines` returns `[]`.

## Editor
- Data embedded in the page: `pageTarget` (1–3 or null) and `charsPerPage`.
- Meter element updates on every edit; text is `≈ {pages} of {target} pages` / `≈ {pages} pages`, with a "met" state.
