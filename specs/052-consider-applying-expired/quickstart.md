# Quickstart: validating #52

Prerequisites: the CI dummy env for unit tests and a scratch database for the route smoke (see the project's local verification notes).

1. **Unit tests**: `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci ANTHROPIC_API_KEY=sk-ci-dummy npm test` — includes `applied-state`, `stage-config`, `stage-time`, `board`, `column-collapse`, catalog parity.
2. **Types and audits**: `npm run lint:types`, `npm run exports:audit`.
3. **Route smoke** on a scratch DB: `npm run build`, start the built-in database on a scratch `APPLYPACK_DATA_DIR`, `prisma migrate deploy`, then `node dist/scripts/route-smoke.js`. Expect: a posting put in Consider, moved to Applying then Applied (apply date only after the last), the board with a card in each end state under No Offer, every page clean in the pseudo-language.
4. **By eye** (desktop 1280px and phone 390px): `/applications` shows the new column row; the No Offer toggle collapses to a rail with title and count, survives reload, works with Tab + Enter/Space; at 390px there is no toggle. A Consider card shows no "applied N days ago". Dark theme still reads.
