# Quickstart: validating the change

1. `npm test` — the resolver and href tests in `src/web/job-facets.test.ts` pass.
2. `npm run lint:types`.
3. Route smoke on a throwaway database (see `.github/workflows/test.yml`; never a live one): `npm run build && npm run smoke:routes`. It checks bare `/jobs` lists only New, `status=all` lists every status, junk gives 400, and the pseudo-language pass finds no English outside the catalog.
4. By eye (dashboard rebuilt): `/jobs` opens on New; tabs read New … All; `/jobs?status=all` highlights All and keeps it through a sort and page 2; "All jobs" back links land on All.
