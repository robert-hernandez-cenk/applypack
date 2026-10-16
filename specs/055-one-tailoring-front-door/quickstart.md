# Quickstart: validating the single front door

Prerequisites: the worktree installed (`npm install`), env `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci` and `ANTHROPIC_API_KEY=sk-ci-dummy` for unit tests, a **throwaway** Postgres for the route smoke.

## Static checks

1. `npm run lint:types`
2. `DATABASE_URL=… ANTHROPIC_API_KEY=… npm test` — includes the rewritten `match-name` tests and `catalog.test.ts`.
3. `npm run exports:audit` — no dead export left from the launcher or scratch row.
4. `npm run css && git diff --exit-code src/web/public/tailwind.css`
5. `npm run i18n:browser && git diff --exit-code` (browser catalog unchanged or regenerated).
6. Schema agrees with migrations: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code` against a shadow database.

## Migration on real-shaped data

7. On the throwaway DB at the previous migration, insert one hidden resume with a match and a letter, plus one ordinary resume with a match. Apply the new migration. Expect: the hidden resume, its match and letter are gone; the ordinary ones remain; `Resume` has no `hidden` column.

## Route smoke (throwaway DB only)

8. `npm run build && npm run smoke:routes` — every GET route answers; `/target` is not in the list; the match form POST with `pages=1` reaches a run; `/letter` POST with a stored job and saved resume reaches a run.

## By hand in the dashboard

9. Job → Resume match: choose a resume and "1 page", Compare → progress page → editor; the comparison shows the 1-page target; edit, Save as vN → a new version appears on Resumes.
10. Request `/target` and `/target?job=1` → not found; the navigation has no Tailor/Target entry; the match card has no "compare a file" link; with no resume the card points to Resumes.
11. `/letter`: pick a stored job and a saved resume → letter drafted on the job page; no upload, paste or new-posting input.
12. Open a comparison made before the change with the text-only marker → opens, same score.
