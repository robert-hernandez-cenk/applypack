# Quickstart
Scratch DB: `APPLYPACK_DATA_DIR=<tmp> npm run db`; seed old-shape rows, apply the migration, check one `user_job` per job for user 1 with equal values. Then `npm run smoke:routes` and `npx tsx --test "src/**/*.test.ts"`.
