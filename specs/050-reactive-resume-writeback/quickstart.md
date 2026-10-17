# Quickstart: validating the write-back

## 1. Automated (no network)

```sh
npm run lint:types
npm test                 # includes reactive-resume*, secret-access, i18n catalog, admin-policy
npm run exports:audit
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code   # throwaway shadow DB, as CI does
```

Expected: all green. The zero-edit roundtrip test and the "markdown identical with and without the map" test pass
over every fixture, including the redacted live v6 one.

## 2. Route smoke (throwaway database only)

```sh
npm run build && npm run smoke:routes
```

Expected: every GET route and the new `POST /tailored/:id/reactive-send` (refused for a resume with no origin; shown
as personal) pass; the pseudo-language pass finds no English outside the catalog.

## 3. Live roundtrip (needs the person's go-ahead — it writes to their instance)

Prerequisite: a connection saved in ApplyPack and a resume in RR (v6.0.3 verified read-only on 2026-10-16).

1. Import the RR resume into ApplyPack (or use the existing one) — its page shows "From Reactive Resume (v6)".
2. Record the original: `GET /resumes/{id}` → keep `updatedAt` and a hash of `data` (scratchpad only).
3. Tailor for any posting, change one bullet and the summary, add one line that belongs to no field, save the copy.
4. Press "Send to Reactive Resume".
5. Expected: a new resume `<Resume> - <Company> - <Role>` in RR; opened in the builder it has the same template,
   colours and section order, with exactly the two changed texts; the added line is listed as not applied.
6. Re-fetch the original: `updatedAt` and `data` hash equal step 2.
7. Repeat the send with the master edited in RR in between → refused as stale, nothing created.
8. Clean up: move the created test resume(s) to Trash in RR (the app does not delete).

Record the redacted result (counts, ids truncated) in the PR; never the key or personal text.
