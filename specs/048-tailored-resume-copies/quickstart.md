# Quickstart: verify tailored resume copies

Prerequisites: a throwaway database (never the live one), `npm run build`.

1. `npm run lint:types && npm test && npm run exports:audit` — green.
2. `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <throwaway>` — empty.
3. `npm run smoke:routes` against the throwaway database. It saves a copy from the target page and checks the resume row is unchanged (text, version, `scannedAt`); a second save leaves one copy; download returns the file; promote bumps the version; delete removes the copy; deleting the resume leaves none.
4. By hand (`npm start` on a scratch `APPLYPACK_DATA_DIR`): open a posting's Resume match tab, edit the text and press "Save tailored copy". The resume page shows the unchanged version and a "Tailored copies" card; the master's comparison count and coverage are as before; comparing another resume shows no skill from the copy.
