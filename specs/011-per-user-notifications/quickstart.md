# Quickstart: validating per-user notifications and settings

1. Scratch database: `APPLYPACK_DATA_DIR=<scratch> npm run db` (never the live folder); `DATABASE_URL` from `db.json`.
2. Migration over old-shape data: apply migrations up to `20261013100000_user_resumes`, seed an `app_settings` row with non-default personal values, two targets, two mutes and a `cron_run`; apply `20261014090000_user_settings`; check `user_settings` row 1 equals the old values, targets/mutes owned by 1, columns dropped; `prisma migrate diff --from-migrations ... --to-schema-datamodel` is empty.
3. Unit tests: `npx tsx --test "src/**/*.test.ts"` (`DATABASE_URL` set to anything); `npm run lint:types`; `npm run exports:audit`.
4. Route smoke on a fresh scratch database: `npm run build && npm run smoke:routes`. Extended checks: user B's settings/targets/mutes invisible and untouched by A; a foreign target id is 404; A's mute does not hide B's jobs; schedule form for a member keeps the global fetch half; display zone and language follow the person.
5. Worker paths exercised by the smoke (`runDigestJob(userId)`, held delivery, pack notice) with the notifier's HTTP calls replaced by the in-process stub already used by the smoke.
