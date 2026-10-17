# Data Model: Jobs list opens on New

No stored data changes. One transient value:

| Name | Values | Meaning |
|------|--------|---------|
| jobs status selection | `NEW`, `ALERTED`, `APPLIED`, `SAVED`, `DISMISSED`, `all` | the current tab; `all` adds no status predicate |

Resolution (`resolveJobsStatus`): `undefined`/`''` → `NEW`; `'all'` → `'all'`; one of the five statuses → itself; anything else (including `new`, lower case) → invalid (400).
