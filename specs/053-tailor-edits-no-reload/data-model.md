# Data model: Keyword edits that keep your place

No stored data changes: no schema, no migration, no new setting.

## Browser-side shapes (in `inline-post.mjs`)

| Name | Fields | Notes |
|---|---|---|
| Queued edit | `action: string`, `body: string` (urlencoded), `form: HTMLFormElement` | Snapshot taken at submit time; the form node may be replaced before it runs. |
| Swap plan | `{ kind: 'swap', ids: string[] }` or `{ kind: 'navigate', to: string }` | Result of `planSwap`; `navigate` when the final path differs or a current region has no counterpart. |
| Focus key | `{ action: string, term: string, name: string }` | `term` is the form's hidden `term` value (empty for the Add form); `name` is the control's `name` or tag. |

## State

- In flight / queue: module-local; one request at a time.
- No `localStorage`: nothing here is a per-viewer preference.
