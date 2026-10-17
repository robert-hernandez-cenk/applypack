# 0084 — With a tailored copy saved, the editor opens on the copy's comparison

**Status:** Accepted (2026-10-17). Amends [0077](./0077-tailored-resume-copies.md) (which comparison the editor shows).

## Context

Saving writes the posting's copy and judges it in a new comparison (`tailoredId` set). The job page's result
card, the history on the resume and the "Tailor resume" links still pointed at the comparison of the base
resume, which is older than the copy. Opening it showed the resume's own words, so a cut accepted there looked
as if it had changed the resume, and Save rebuilt the copy from those words, throwing away what the copy
already had. Live rows showed it: the copy was 10,846 characters, the base comparison the editor opened
13,018, and the resume itself untouched.

## Decision

- `GET /jobs/:id/target` redirects a base-resume comparison **older than the posting's copy** (not a draft,
  `staleBaseMatch` in `tailored.ts`) to the copy's newest comparison, with a message saying so.
- A history chip of a base run adds `base=1` and opens it as it is; so does the Condense return link of a base
  comparison, so a step started there comes back there.
- A draft, and a comparison made after the save, are the person's own newer text and are left alone.

## Alternatives considered

- **Change every link to name the copy's comparison.** Eight places build that URL; one would be missed.
- **A banner on the stale editor instead of a redirect.** Leaves the person editing the wrong text with a
  warning above it.
