# Quickstart: validating the Reactive Resume import

## Prerequisites

`npm ci`; for the route smoke a throwaway database (see `.github/workflows/test.yml`).

## 1. Pure + stand-in tests

```sh
npm run lint:types
npm test            # includes reactive-resume*.test.ts and pull-stash.test.ts
npm run exports:audit
```

Expect: v4/v5/v6 fixtures read to Markdown; hidden items absent; HTML flattened; non-export refused; private addresses refused for a member and allowed for an administrator; key absent from every logged and rendered string.

## 2. File route, by hand

`npm start` on a scratch folder (`APPLYPACK_DATA_DIR=/tmp/ap WEB_PORT=4848 APPLYPACK_NO_OPEN=1 npm start`), open `/resumes`, upload each fixture from `src/resume/fixtures/reactive-resume/`. Expect a new resume per file, a scan, the text on the resume page, a second identical upload giving the duplicate notice, and `not-rr.json` giving the plain-words refusal.

## 3. Live route, against a stand-in

Run the stand-in used by `reactive-resume-api.test.ts` (or any server answering `GET /api/openapi/resumes` and `/resumes/{id}` with `x-api-key`), enter its `http://127.0.0.1:<port>` and a key on `/resumes`. Expect the picker, then the saved resume. Repeat as a member on a non-local install: the loopback address is refused.

## 4. Route smoke

`npm run build && npm run smoke:routes` on a throwaway database: the two POSTs are in the policy list and the new strings pass the pseudo-language run.

## Not verifiable here

A real hosted or self-hosted Reactive Resume export/instance: fixtures and the stand-in follow the published docs only.
