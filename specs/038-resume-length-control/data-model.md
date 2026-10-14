# Data model: Page target (#38)

No schema change, no migration.

## PageTarget
`'keep' | 1 | 2 | 3` (`src/resume/length.ts`).
- Form value `pages`: `"keep" | "1" | "2" | "3"`; anything else parses to `keep` (`parsePageTarget`, like `parseMatchMode`).
- Stored value: key `pages` in `ResumeMatch.breakdown` JSON. `readPageTarget(breakdown)` returns `keep` when the key is missing or not one of 1/2/3.

## LengthPlan (derived, never stored)
From `(text, target)`:
- `pages`: estimated pages, `text.length / CHARS_PER_PAGE`.
- `budgetChars`: `target * CHARS_PER_PAGE`, null for `keep`.
- `overshootChars`: `max(0, text.length - budgetChars)`, 0 for `keep`.
- `met`: `overshootChars === 0`.
- `cutBudget`: how many removals the prompt may ask for (D6 in research.md).

`lengthPlan(text, 'keep')` carries no budget, and `lengthLines` returns `[]` for it, so `keep` prompts are unchanged.

## Where it is carried
| Place | Field |
|---|---|
| Launcher form (`target-start.tsx`) | `pages` select |
| `TargetFormSchema` (`routes/target.tsx`) | `pages` → `parsePageTarget` |
| `ComparisonRequest` (`comparison-run.ts`) | `pages: PageTarget` |
| Run key | `target:${resume.id}:${mode}:${pages}:${hash}` / `match:${jobId}:${resume.id}:${mode}:${pages}:…` |
| `matchResumeToJob` opts | `pages?: PageTarget` (default `keep`) |
| `storedBreakdown` meta | `pages: PageTarget` (required, so the compiler names every write) |
| `reuseDecision` / `pickReusable` | `pages` compared with the stored marker |
| `suggestForMatch` | reads `readPageTarget(match.breakdown)` |
| Editor page data | the target and `CHARS_PER_PAGE` embedded for `length.mjs` |
