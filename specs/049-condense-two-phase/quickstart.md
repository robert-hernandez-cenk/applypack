# Quickstart: validating Condense

Prerequisites: `npm ci`, a throwaway Postgres (`npm run db`), `npm run build`.

1. Pure checks: `npm run lint:types && npm test && npm run exports:audit`.
2. Migration: `npx prisma migrate deploy`; `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` reports no drift.
3. Route smoke on a throwaway database: `npm run smoke:routes` (the editor renders the Condense panel; the three POSTs are refused or run as specified in [contracts/routes.md](./contracts/routes.md)).
4. Live check with a real key on a long resume: compare it with a 1-page target, open the editor, press Find cuts, apply cuts, press Tighten wording, press Refresh suggestions; confirm the stored `removals` survive the refresh and the ledger shows `resume-condense-cuts` and `resume-condense-words`.
5. Screenshot the editor with the panel open (over target) and collapsed (within target).
