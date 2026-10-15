# Quickstart: check the fix

Prerequisites: the worktree with `npm ci` done; no database or `.env` is needed for the pure checks.

## 1. The module's own tests

```bash
npm --prefix <worktree> run lint:types
(cd <worktree> && node --import tsx --test src/resume/reactive-resume.test.ts src/resume/resume-text.test.ts)
```

Expected: both pass. New cases cover a profile with an address and a username, a username-only profile, a hidden profile, the three generations, an address shared with the website, an anchor with words, an anchor whose words equal its address, a `javascript:` target, and 300 000 characters of unterminated `<a ` markup read in under a second.

## 2. Read a fixture by hand

```bash
(cd <worktree> && node --import tsx -e "
const { readReactiveResume } = require('./src/resume/reactive-resume');
const j = require('./src/resume/fixtures/reactive-resume/v6.json');
console.log(readReactiveResume(j).markdown.split('\n').slice(0, 4).join('\n'));
")
```

Expected: the third line ends with `https://github.com/arivera`, and the output has no `## Profiles`.

## 3. The whole suite against the baseline

```bash
npm --prefix <worktree> test
```

Expected: the same 35 files fail as before the change (missing `.env`, "Invalid environment configuration"); no new failure.

## 4. With the owner's real export (not automated)

Import a real Reactive Resume export (file or pull) in a running install; open the resume, press **Download original**, and confirm the GitHub and LinkedIn addresses are in the header line. If an address is missing, save that export, redacted, as a fixture: the profile's address lives somewhere `websiteOf` does not read (research R1).
