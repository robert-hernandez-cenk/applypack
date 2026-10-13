# Quickstart (validation)

1. `APPLYPACK_DATA_DIR=<scratch> npm run db` for a throwaway Postgres; set `DATABASE_URL` from `db.json`.
2. Apply migrations over a database that already has searches and an `activeProfileId`; confirm user 1 owns them and `users.primaryProfileId` carries the old primary; `npx prisma migrate diff` reports no drift.
3. `npx tsx --test "src/**/*.test.ts"`, `npm run lint:types`, `npm run exports:audit`.
4. Scratch-DB script: two users; list/edit/delete cross-user is "search gone"; cap is per user; one scoring pass writes JobScore for both users' searches.
5. `npm run build && npm run smoke:routes` on the scratch DB.
