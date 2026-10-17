# 11 - UX Flow Audit of 10a-10c

A review of the flows in `10a`, `10b` and `10c` with the ux-flow-designer checklist: entry points, branch coverage, error recovery, screen states, system annotations, collapsed steps, and consistency across journeys.

Method. One reviewer per document read the journeys without the code and listed gaps. A second pass then checked the findings that mattered most against the source. Only what the source supports is recorded as a finding below. Claims the source refuted are listed at the end so they are not raised again.

Evidence is `file:line` as reported by the checking pass. Re-read the line before acting on one.

## 1. Verdict

Every journey draws the happy path and its main failures well. The gaps are in three places: recovery after a failure, rules that should hold across journeys, and states the diagrams never draw (an AI that is unavailable, an unscanned resume, a stale tab).

## 2. Verified findings

Severity is the effect on the person using the app: High loses work or leaves them stuck, Med confuses or costs a retry, Low is a documentation or polish gap.

| # | Finding | Sev | Where | Evidence |
|---|---|---|---|---|
| F1 | No run can be cancelled. The run routes are GET plus the one POST that starts a run. The only cancel is for a queued pack. | High | 10a J11; every progress page | `routes/target.tsx:19-50`, `routes/runs.tsx:71-133`, `routes/pack.ts:41` |
| F2 | A form POST after the OIDC session ends (default 8 h) gets a bare `401` text page and the typed data is lost. Inline forms show "not saved". Only a GET is redirected to sign-in. | High | 10c B1, every POST form | `oidc/gate.ts:34-37`, `inline-post.mjs:174-184`, `oidc/settings.ts:9` |
| F3 | Four different answers to "you cannot use this". Employer mode off: warning redirect to Settings. Member on an admin route: 403 page. Member on `?tab=screening`: silent fallback to Profile. Member on `/welcome`: silent redirect to `/`. | High | 10c A1, B2 | `employer-mode.ts:41-45`, `admin-guard.tsx:21-32`, `pages/settings.tsx:201-205` |
| F4 | A pack waits as "queued" forever when the worker is not running. The copy promises "within a minute", the page polls with no limit and no age check. Cancel is the only exit. | High | 10b J12 | `pack-tab.mjs:49-60`, `en.json:2858` |
| F5 | Leaving the Tailor editor with unsaved edits has no guard, and a failed comparison sends the person to `/jobs`, not back to the editor. The text itself survives in `localStorage` (`target-draft:<matchId>`), so it comes back only if they reopen the same match. | Med | 10b J5 | `target-page.mjs:216,421,1009`; `target-runs.ts:112-113`; no `beforeunload` in `src` |
| F6 | Some Tailor actions carry the editor text and some drop it. Carried: Analyse again, Save, Shorter wording, Refresh. Not carried: Find cuts, per-card Rewrite, Rewrite all. | Med | 10b J5, J6 | `target.tsx:479,498,819-823`, `condense-panel.tsx:77,99`, `jobs.tsx` condense route |
| F7 | Nothing checks whether a resume is scanned before Strength review, Compare, Cover letter or Pack prepare. They run on the raw text. Only "create search from resume" and the profile fill require a scan. The UI shows a "not scanned" badge and nothing else. | Med | 10b J3, J4, J9, J12 | `resumes.tsx:694`, `resumes.tsx:648`, `welcome.tsx:305,330` |
| F8 | Pages rendered straight from a POST, so a reload resubmits: the render preview ("Update the preview") and the Reactive Resume pick page. This breaks the stated rule that every mutation answers `303`. | Med | 10b J10, J11 | `resume-render.tsx:155`, `resumes.tsx:201` |
| F9 | The AI budget is advisory only. Nothing blocks or skips AI calls when it is spent. The person sees a chat alert at 80% and 100% and a "billed vs budget" line, and no flow draws "AI unavailable". | Med | 10a J14 and every violet button | `ai-ledger.ts:61-82`, `pages/ai-usage.tsx:193-201` |
| F10 | A persistent `500` on a screening run's `/state` poll reloads the workspace every 2 s with no cap. If employer mode is turned off mid-run, the poll follows the redirect, `res.json()` throws, and the page retries every 2 s without ever reloading. | Med | 10c A4 | `public/screen.mjs:63-70` |
| F11 | After a web restart a scoring run does not resume. The data survives and `listPending` picks up the unscored rows, but the person must press Score again. The 10c wording "a restart resumes from what is missing" reads as automatic. | Med | 10c A4 | `screening/batch.ts:18,65`; callers only in `routes/screen.tsx` |
| F12 | A flash cookie lasts 5 s. A redirected GET that takes longer drops the flash silently. | Low | 10c C2 | `flash.ts:41,63`; `toast.mjs:23` |
| F13 | The generic run page sends an unknown or expired run to `/jobs` whatever started it (wizard scan, watchlist, pack). Fetch now and the cron run page go to `/runs`. | Med | 10a J11, J1 | `target.tsx:39-41`, `runs.tsx:103-108,130` |
| F14 | Success is silent in some places and flashed in others. "Mark applied" and a successful "Re-classify" redirect with no flash. "Consider" flashes. | Low | 10a J4 | `jobs.tsx:684,709-710`, `rescore-flash.ts:16` |
| F15 | "Paste a job" and "fill from resume" (when the resume is unscanned) do their AI work inside the request with no progress page, unlike scan, score and import. | Med | 10a J5, J12 | `routes/jobs.tsx:381`, `manual-job.ts:114`, `routes/settings.tsx:1534-1535` |
| F16 | HN "Run now" and Gmail "Check now" confirm only that the work started. Completion shows on `/runs` or on a later page load. | Low | 10a J8, J18 | `routes/discovery.tsx:65-82`, `routes/gmail.ts:76-83` |
| F17 | No way to add a user. Users appear at first OIDC sign-in as members. Without sign-in the Users page shows one row and a notice. | Low | 10a J19 | `routes/users.tsx`, `users/store.ts:30` |
| F18 | Working resumes are one per job per resume in the database (`@@unique([resumeId, jobId])`) and one per job only in the UI rule. 10b J5 and J7 each state one half. | Low | 10b J5, J7 | `schema.prisma:908`, `tailored.ts:27-37` |
| F19 | Save needs 200 characters or more, and the document route accepts 1 to 200,000. A short edit can be previewed and not saved. | Low | 10b J7 | `resumes.tsx:103-105,479-483`, `resume-document.ts:29,40` |
| F20 | A failed Compare stops a pack. A failed verify or letter does not. The flow does not draw this difference. | Low | 10b J12 | `prepare.ts:177-181,199-205,263-267` |

## 3. Cross-journey rules to settle

These are decisions, not drawings. Until they are made, each journey invents its own answer.

1. **Run lifecycle.** Pick one of: progress page, inline request, or start-and-flash, per kind of work, and state whether any can be cancelled (F1, F15, F16).
2. **Return target after a run.** Go back to where it started, not to `/jobs` (F13).
3. **Denied or unavailable.** One treatment for "this is not for you" and one for "this feature is off" (F3).
4. **Silent success.** Say which actions may succeed without a flash (F14).
5. **Prerequisites.** Say what a resume needs (scanned, a default) before a violet button works (F7, F9).
6. **Direct-from-POST pages.** Either redirect, or draw the reload behaviour (F8).
7. **Expired session on a POST.** Return the person to sign-in with their input kept, or say it is lost (F2).

## 4. Documentation corrections

The source disagrees with the flow documents here. Fix the documents.

| Document | Says | Source shows |
|---|---|---|
| 10c A4 | A restart resumes scoring from what is missing | The run does not restart. Score has to be pressed again (F11) |
| 10b J5 | Nothing is saved until Save, no mention of the draft | Edits persist in `localStorage` per match (F5) |
| 10b J9 | Silent on what a failed optional step does | A failed match or verify adds a warning to the result flash and the letter still runs (`routes/letter.tsx:120-144`) |
| 10b J10, J11 | Preview and pick page "no redirect" without the consequence | A reload resubmits the POST (F8) |
| 10c C2 | Flash cookie 5 s | A redirect slower than 5 s drops the flash (F12) |

All of these are applied to 10b and 10c. 10a needed no change.

## 5. Findings the source refuted

Do not raise these again.

- **Condense runs have no failure path.** They run on the progress page with an error panel and a back link to the editor (`condense-run.ts:34-35,62`).
- **A failed optional match or verify stops the cover letter.** It does not. The `/letter` launcher runs them first, a failure becomes a warning on the result flash, and the letter runs on whatever is stored (`routes/letter.tsx:120-144`, `cover-letter.ts:56-73`). The 10b J9 diagram was right.
- **The schedule form is shown to members and then refused.** It is rendered in a disabled `fieldset` with no Save button. Only a hand-made POST reaches the refusal (`pages/settings.tsx:417,435-439`).
- **Two first sign-ins can both become admin.** The default user is claimed with an `updateMany where oidcSub: null`, so one caller wins and the other is a member (`users/store.ts:35-37`). Last-admin and self-demotion are refused (`users/rules.ts`).
- **Applicant upload errors are one generic message.** There are separate clauses for oversized, not a resume, bad archive, truncated archive, unreadable, over room and held (`routes/screen.tsx:493-502`).
- **A 403 on the screening poll loops.** The reloaded page is the 403 page, which has no poller.

## 6. Not checked

These came from the document review and were not confirmed against the source, so treat them as questions.

- 10a J2: a member sees a "Paused" warning that links to a setting only an admin can change.
- 10a J3: an out-of-range `page` with no filters shows "no jobs yet".
- 10a J7 and J9: partial-failure branches of the watchlist and pack previews, and a new watchlist submit dropped when a run is already live.
- 10a J10: a new folder saves switched off and the flow does not say how to switch it on.
- 10b J1 to J4 and J8: smaller missing branches on the resume library, strength review and verification.
- 10c A5 to A8: bulk action edge cases, compare bookmarks, and delete during a live run.

## 7. Next

The six weakest journeys are redrawn with the missing branches in [11a-redrawn-flows.md](./11a-redrawn-flows.md).
