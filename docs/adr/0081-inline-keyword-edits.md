# 0081 — A form can change part of a page in place: the post follows its redirect, named regions are swapped

**Status:** Accepted (2026-10-17). Issue #53. Builds on [0061](./0061-the-interface-speaks-several-languages.md) (browser modules speak
through `t()`), and on the dashboard's rule that every write is a form post answered with a redirect.

## Context

Every keyword edit on the tailor page and on the Resume match tab was a form post answered with a 303 and a
one-shot flash cookie. The page loaded again each time: the view jumped to the top, focus was lost, and on the
tailor page the live editor (`target-page.mjs`, which holds the resume text, the unsaved bar and the applied-edit
marks in the page) started over. A person correcting twenty keywords made twenty trips back down the page.

The server side is sound and shared by every client: one route, one redirect, the message in the cookie. The issue
asked to keep it that way (a browser without script must still work) and to keep browser code dependency-free.

## Decision

- **Opt-in by attribute.** A `<form data-inline>` is posted with `fetch` by `public/inline-post.mjs`
  (`wireInlinePosts(document)`, one delegated listener). Without the attribute, without script or without `fetch`,
  the form posts as before.
- **The post follows its own redirect.** No new endpoint, no second response shape: `fetch` follows the 303, the
  flash cookie set by the post is read by the page it lands on, and that page is parsed.
- **Regions, by id.** Elements marked `data-region` (with an `id`) are replaced as a whole by the element of the
  same id in the returned page: the flash slot (always rendered by `Flash`), the keyword table, and what a keyword
  edit changes about the score (see `specs/053-tailor-edits-no-reload/contracts/inline-regions.md`). If the answer
  is a different path, or lacks a region the page has, it is not the page being edited (a sign-in page, a moved
  address) and the browser goes where the server went.
- **What holds state is not a region.** The tailor page's ring, length line, editor and unsaved bar are never
  swapped. After a swap the module dispatches `inline:swapped`; the page hands the fresh `#target-data` to
  `init()`'s `refresh()`, which lays it over its data and draws again.
- **Edits are applied in order, once.** One request at a time; the body is a snapshot taken at submit time (the form
  may be replaced before its turn); a form already waiting ignores a second press. Focus returns to the same
  control (by form, keyword and field name), open folds stay open, and scroll is left alone.
- **A failure says so.** A request that cannot be made, or an error status from the post itself, puts
  `browser.inline.failed` in the flash slot and announces it; nothing looks saved that is not. An error on the page
  the post was redirected to means the save happened, so the browser goes to that page as the old reload did.

## Alternatives considered

- **A fragment or JSON response for fetch requests**: a second response shape per route that drifts from the page,
  and a branch on a request header in every route that wants it. The cost of this decision, one extra page render
  per edit, is small next to that.
- **Swapping `<main>`**: replaces the live editor, which is exactly what the issue is about.
- **Remembering the scroll position and reloading**: keeps the view but still re-boots the editor and loses focus.

## Consequences

✅ A keyword edit changes the row, the score and the message, and nothing else; the editor draft is untouched.
✅ The next form that should stay in place adds `data-inline` and region ids; no per-page script.
✅ No server change, no new endpoint: the no-script path and the smoke test are the same as before.
❌ One extra render of the page per edit.
❌ Parts of the page that are not regions (the confirm-fact lists, the Suggestions block) keep what they showed
until the next load; a keyword edit does not change the Suggestions, and the confirm lists may still ask about a
keyword the person has just ignored.
❌ (Resolved by [0082](./0082-flash-messages-as-toasts.md).) The message appears in the flash slot at the top of the page; a person far down the list sees the row change
and hears the message announced, but does not see it (a toast is tracked separately).

## When to revisit

A page whose in-place update needs more than its regions (derived client state that cannot be handed over like
`refresh()`), or the toast work for the flash banner.
