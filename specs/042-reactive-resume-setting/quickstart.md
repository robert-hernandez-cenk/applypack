# Quickstart: validating the saved Reactive Resume connection

## Automated

```bash
npm run lint:types && npm test && npm run exports:audit
```

Key tests: `reactive-connection.test.ts` (key cleaning, view), `reactive-connection-access.test.ts` (closed list, explicit `select`, no key in the view), `pull-stash.test.ts` (no key, target, owner, TTL), route tests for save/remove/list/import with the #39 stand-in server, `catalog.test.ts` (all four catalogs), `admin-policy` route-listing test.

Route smoke on a **throwaway** database only (it inserts rows): `npm run build && npm run smoke:routes`. New steps: save a connection against the stand-in, list from `/resumes`, import as new, list from a resume, import as a new version, remove.

## Manual (local install, `npm start` on a scratch data folder)

1. Settings → Job search: the Reactive Resume card reads "not connected". Resumes page: no address/key fields, a pointer to Settings.
2. Save a wrong key → plain "key refused" message, card unchanged.
3. Save a correct address + key → "Connected to <host>. A key is saved." View the page source: the key appears nowhere.
4. Resumes → list → pick → a new resume appears and is scanned.
5. Open a resume at v1 → Upload a new version → From Reactive Resume → pick one with different text → v2, scanned, name unchanged. Pick again with unchanged text → "same as current version", still v2.
6. Replace the connection with a bad key → old connection still works. Remove → card empty, pointers back.
7. As a member on a shared install (second user): a loopback address is refused at save.

Unverifiable here without a real instance: behaviour against a live hosted/self-hosted Reactive Resume (the stand-in follows the published shapes, as in #39).
