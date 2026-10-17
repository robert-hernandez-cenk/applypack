# Contract: inline forms and regions

The interface between the server-rendered pages and `public/inline-post.mjs`. No HTTP endpoint is added or changed.

## Markup

| Attribute | On | Meaning |
|---|---|---|
| `data-inline` | `<form method="post">` | Post with `fetch` and update regions instead of navigating. Without it (or without script) the form posts normally. |
| `data-region` + `id` | any element | Replaced, as a whole, by the element with the same id in the page the post returns. Ids are unique per page. |
| `data-fold="<name>"` | `<details>` inside a region | Its open state is carried over a swap. Names: `matched`, `ignored`. |

Regions used:

| id | Page | Content |
|---|---|---|
| `flash-slot` | every page that renders `Flash` | The message banner (empty element when none). |
| `keyword-table` | tailor page, match tab | `KeywordTable` root, including the Add form. |
| `kw-fold-count` | tailor page | The keyword fold's summary text. |
| `score-advice` | tailor page | Main advice line and score ceiling line. |
| `score-ready` | tailor page | The "ready to apply" line. |
| `delta-box` | tailor page, match tab | The comparison with the previous version. |
| `match-score` | match tab | Score badge and its change. |
| `match-breakdown` | match tab | Score breakdown chips. |

## Request / response

- Request: `POST <form action>`, `application/x-www-form-urlencoded`, the form's fields plus the pressed button.
- Response: whatever the route already returns; a 303 to the page, followed by `fetch`; the final HTML is parsed.
- Acceptable final response: status 200, same pathname as the current page, and every current region present.
  Otherwise the browser navigates to the final URL.

## Events

`inline:swapped` on `document`, after the swap, `detail: { doc }` (the parsed returned page). The tailor page
listens and calls `refresh(readData(doc))`.

## Messages

`browser.inline.failed` — shown in `#flash-slot` as an error when the post could not be made.
