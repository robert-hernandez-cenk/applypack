# Contract: dashboard route and page

## Route

`POST /tailored/:id/reactive-send` — personal route (`PERSONAL_ROUTES`), same-origin POST (existing CSRF guard),
`onceGuard` keyed `reactive-send:<user>:<id>` so a double submit runs one send.

1. Resolve the copy and its resume through the signed-in person (`getTailoredWithFile`); not theirs → flash
   `resume.tailored.gone`.
2. No `remoteId` → flash `reactive.send.fail.noOrigin`. Generation not `v6` → `reactive.send.fail.generation`.
3. Read the person's connection (`readInstanceKey`); none → `reactive.fail.noConnection`. `reachable` refusal →
   existing `REACH_FAILURE` words.
4. Run `reactiveWriteBack(io, { remoteId, masterText, copyText, name })`.
5. Redirect back (`Referer`-independent: to `/jobs/<jobId>/target?match=…` when posted from the target page, else
   `/resumes/<id>#tailored`) with a flash:
   - success: `reactive.send.ok` (count applied, link to the new resume via `tRich`), plus `warn` flash
     `reactive.send.partial` listing each not-applied edit (label + line + reason) when any.
   - failure: `reactive.send.fail.<code>`; when `createdRemoteId` is set, the flash names it.

The form carries a hidden `back` field restricted to the two allowed destinations; anything else falls back to the
resume page.

## Page

- `pages/resume-detail.tsx` `TailoredCard` row actions: a secondary small button "Send to Reactive Resume" next to
  Download, rendered only when `resume.remoteId !== null` and the person has a connection (else omitted; the card
  hint says why once).
- `pages/target.tsx` saved-copy line: the same button beside the download link, same condition.
- The resume page shows "From Reactive Resume (<generation>)" under the name when `remoteId` is set, in `data-ui="hint"`.
- Words: all through `t()`; reasons as functions of the code in the reader's language; company/role in the new
  resume's name are data (`translate="no"`).
- Accessibility: a real `<form method="post">` button with an accessible name that includes the posting
  (`reactive.send.aria`); result flashes use the existing flash region.
