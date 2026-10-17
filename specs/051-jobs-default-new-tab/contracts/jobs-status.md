# Contract: `GET /jobs?status=`

| Query | Result |
|-------|--------|
| (absent) or `status=` | 200, New postings, New tab current |
| `status=NEW\|ALERTED\|APPLIED\|SAVED\|DISMISSED` | 200, that status |
| `status=all` | 200, every status, All tab current |
| any other value | 400 (`http.invalidQuery`) |

Tab order: New, Alerted, Applied, Saved, Dismissed, All. All other query keys (`q`, `sort`, `page`, panel filters) are unchanged and are carried on every link together with the current `status`.
