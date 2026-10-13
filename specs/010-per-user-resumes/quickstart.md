# Quickstart: verifying per-user resumes

1. Scratch Postgres: `APPLYPACK_DATA_DIR=<scratch> npm run db`; `DATABASE_URL` from `db.json`.
2. Migration over old-shape data: apply migrations up to `20261012220000_user_jobs`, seed a resume, match, review, fact, letter, pack and an applied link, apply the new migration, check every row has userId 1 and counts are equal; `prisma migrate diff --from-migrations ... --to-schema-datamodel` is empty.
3. `npm run lint:types`, `npx tsx --test "src/**/*.test.ts"`, `npm run exports:audit`.
4. Route smoke on a fresh scratch DB (`npm run build`, `npm run smoke:routes`): includes a second user with a foreign resume, match, letter, fact and pack; every foreign id answers 404 and a list never shows the other person's rows.
5. Pack tick check: two users with packs on, one posting kept by both, two pack rows with different `userId`, each prepared with its owner's resume (smoke fixture, no AI).
