/*
 * Every GET route of the dashboard gets one request, in-process, against a
 * database that has just been migrated — plus the POSTs that create the rows
 * the other pages need, and one clean PDF render. No browser, no AI (the one
 * background scan it starts fails fast with no engine), no network. A route
 * that answers 500, or 4xx where 2xx/3xx is expected, fails the run.
 *
 * Run it on a throwaway database only — it inserts a job, a resume, a
 * screening and an applicant (and a search, where nothing was seeded), and
 * switches employer mode on:
 *
 *   DATABASE_URL=postgresql://…/scratch npx prisma migrate deploy
 *   npm run build && DATABASE_URL=… AI_PROVIDER=claude_code npm run smoke:routes
 *
 * CI runs exactly that on a Postgres service (.github/workflows/test.yml).
 * 145 handlers had zero automated requests before this (audit 2026-09-10,
 * TEST-1); the unit tests cover the pure modules, this covers the wiring.
 */
import { DEFAULT_USER_ID } from '../users/identity';
import { SMOKE_INBOX } from './route-smoke-env';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { app } from '../web/app';
import { withCurrentUser } from '../web/current-user';
import { requireHeldJob } from '../web/job-guard';
import { jobsRoute } from '../web/routes/jobs';
import { applicationsRoute } from '../web/routes/applications';
import { resumesRoute } from '../web/routes/resumes';
import { factsRoute } from '../web/routes/facts';
import { packRoute } from '../web/routes/pack';
import { listProfilesForResume } from '../profiles';
import { loadUser } from '../users/store';
import { DEFAULT_BODY_BYTES } from '../web/body-limits';
import { prisma } from '../db';
import { createManualJob } from '../jobs/manual-job';
import { createMatch, createResume, getResume, listFacts, upsertFact } from '../resume/store';
import { parseMatchResponse, PROMPT_VERSION } from '../resume/prompts';
import { scoreMatch } from '../resume/score';
import {
  addNotificationTarget,
  deleteNotificationTarget,
  getAlertSchedule,
  getDisplaySettings,
  getNotificationTarget,
  getPackSettings,
  getSchedule,
  getSettings,
  getUserSettings,
  listActiveNotificationTargets,
  setAiBudgetCents,
  setEmployerMode,
  setFetchingEnabled,
  setPersonalSchedule,
  setTelegramEnabled,
} from '../settings';
import { settingsRoute } from '../web/routes/settings';
import { companiesRoute } from '../web/routes/companies';
import { deliverHeldAlerts } from '../jobs/alert-delivery';
import { runDigestJob } from '../jobs/digest-job';
import { lastSuccessfulRunAt } from '../jobs/cron-run';
import { loadEmployerRulesFor, mutedKeys } from '../jobs/employer-store';
import { employerGates } from '../employer';
import { sendAlert, sendBudgetAlert } from '../notifier';
import { blankProfileInput, createProfile, ensurePrimaryProfile, listAllActiveProfiles, updateProfile } from '../profiles';
import { recordAiCall } from '../ai-ledger';
import { NO_USAGE } from '../ai-usage';
import { createApplicants, createScreening } from '../screening/store';
import { draftRubric } from '../screening/rubric';
import { fingerprintText } from '../screening/intake';
import { tryFetchLock } from '../jobs/fetch-lock';
import { addToFunnel } from '../jobs/funnel-store';
import { autoPacksToday, listUnnotifiedPacks, loadPackInputs } from '../pack/store';
import { getFetchRun } from '../web/fetch-runs';
import { claimRun, getRun } from '../web/target-runs';
import { classesOf } from '../users/admin-policy';
import { changeUser } from '../users/store';
import { parseFlashCookie } from '../web/flash';
import { writeFileSync } from 'node:fs';
import { PSEUDO_LOCALE } from '../i18n/locale';
import { hardcodedText } from '../i18n/pseudo';
import { SETTINGS_ID, setLocale } from '../settings';

/** What a page may answer: itself, or a redirect to where the state lives. */
const ACCEPT = new Set([200, 302, 303]);
/** Routes whose subject is a run that has finished or a file that was never written: 404 is the honest answer. */
const MAY_404 = new Set([
  '/target/runs/:id/state',
  '/runs/fetch-now/:id/state',
  '/companies/watchlist/:id/state',
  '/jobs/:id/cover/:letterId/file/:fmt',
  // No letter is attached until the upload below runs.
  '/screen/:id/applicants/:aid/letters/:lid/file',
  // A pack keeps a file only once the worker has prepared it (ADR 0063); nothing here runs one.
  '/jobs/:id/pack/resume.docx',
  '/jobs/:id/pack/resume.pdf',
  // Nor a state to ask for until a pack is queued; the queued one is asked below.
  '/jobs/:id/pack/state',
  // The fixture company is a pasted job's, not a folder; the folder walk below asks a real one.
  '/companies/:id/files',
]);
/** GETs the route patterns do not reach: a page under its query parameters (`:id` = the fixture job). */
const QUERY_VARIANTS = [
  // Every /jobs filter at once, the panel open: the where-clause, the facet tally and the status counts together.
  '/jobs?panel=1&status=NEW&q=node&minFit=10&sort=fitScore_desc&verified=1&watched=1&open=1&muted=1&country=DE,EU,unknown&workplace=remote,unknown&posted=30d',
  // The job page's three other tabs, and a tab nobody offers — that one must fall back, not fail.
  '/jobs/:id?tab=match',
  '/jobs/:id?tab=letter',
  '/jobs/:id?tab=verify',
  '/jobs/:id?tab=pack',
  '/jobs/:id?tab=nonsense',
  // The AI ledger over each period, and a period nobody offers (ADR 0055).
  '/ai?period=month',
  '/ai?period=year',
  '/ai?period=nonsense',
  // Step 1 asks the default local addresses for a model server (TASKS S1); nothing answering is the usual case.
  '/welcome?step=ai',
];
/** The Overview under its chart's parameters; asked last, once setup is skipped (a fresh database redirects `/`). */
const OVERVIEW_VARIANTS = [
  '/',
  '/?range=7d&stack=node.js',
  '/?range=90d',
  // A technology on a range the jobs no longer cover, and values nobody offers: both fall back, neither fails.
  '/?range=180d&stack=node.js',
  '/?range=nonsense&stack=%3Cscript%3E',
];
/**
 * Pages the route patterns draw once but that hold several: each tab and each
 * wizard step is its own screenful of words for the pseudo-language pass.
 */
const PSEUDO_VARIANTS = [
  '/jobs/:id?tab=match',
  '/jobs/:id?tab=letter',
  '/jobs/:id?tab=verify',
  '/settings?tab=sources',
  '/settings?tab=notifications',
  '/settings?tab=applications',
  '/settings?tab=automation',
  '/settings?tab=ai',
  '/settings?tab=general',
  '/settings?tab=screening',
  '/welcome?step=ai',
  '/welcome?step=search',
  '/welcome?step=profile',
  '/welcome?step=sources',
  '/welcome?step=matches',
];
/** The words a page holds that are nobody's to translate: the product's name. */
const NOT_INTERFACE = /\bApplyPack\b/g;
/** How many pages the summary names; `--pseudo-list <file>` writes every run of every page. */
const PSEUDO_TOP = 12;
/** A failing page names its first few runs, cut short: enough to find them in the code. */
const PSEUDO_SHOWN = 3;
const PSEUDO_RUN_CHARS = 60;
// app.request() builds no Host header of its own, and the origin guard
// compares Origin's host with it (same-origin.ts) — so the request says both.
const ORIGIN = { origin: 'http://localhost', host: 'localhost' };

const POSTING = [
  'Backend Engineer (Node.js, TypeScript, PostgreSQL). We build the services behind a scheduling product:',
  'REST APIs in Node.js and TypeScript, PostgreSQL with Prisma, Docker on a small VPS. You will own two',
  'services end to end, review pull requests, and keep the on-call rota honest. Remote within the EU.',
].join(' ');
const RESUME = [
  'Jane Example — Backend Engineer. Skills: Node.js, TypeScript, PostgreSQL, Prisma, Docker, Redis.',
  'Experience: Acme (2021–2026), backend engineer — built the billing service in Node.js and TypeScript,',
  'moved it from MySQL to PostgreSQL, cut p95 latency by 40%. Education: BSc Computer Science.',
].join('\n');

interface Fixtures {
  jobId: number;
  companyId: number;
  resumeId: number;
  screeningId: number;
  applicantId: number;
  /** TASKS N8: a watched careers page drawn in the browser, for the paste box. */
  browserPageId: number;
}

async function fixtures(): Promise<Fixtures> {
  const job = await createManualJob(
    { companyName: 'Smoke Co', title: 'Backend Engineer', url: '', location: 'Remote', description: POSTING },
    DEFAULT_USER_ID,
    { classify: false },
  );
  const resume = await createResume(DEFAULT_USER_ID, {
    name: 'Smoke resume',
    sourceFilename: 'smoke.txt',
    mimeType: 'text/plain',
    original: Buffer.from(RESUME),
    text: RESUME,
  });
  await setEmployerMode(true);
  const screening = await createScreening({
    jobId: job.job.id,
    title: 'Smoke screening',
    postingText: POSTING,
    rubric: draftRubric(null),
    retainUntil: new Date(Date.now() + 7 * 86_400_000),
  });
  const print = fingerprintText(RESUME);
  const {
    created: [applicant],
  } = await createApplicants(screening.id, [
    {
      name: null,
      email: null,
      phone: null,
      sourceFilename: 'smoke.txt',
      mimeType: 'text/plain',
      original: Buffer.from(RESUME),
      text: RESUME,
      redactedTextFor: (n) => RESUME.replace('Jane Example', `Applicant №${n}`),
      redactions: [],
      parseStatus: 'ok',
      parseNote: null,
      sameAs: null,
      textHash: print.hash,
      simhash: print.simhash,
    },
  ]);
  if (!applicant) throw new Error('smoke fixture: the applicant was not written');
  // The ledger through its own write path: each kind of money, a timeout with
  // no usage, a model the price table does not know — and a one-cent budget,
  // so the billed row crosses it and the warning path runs (no chat here, so
  // it sends nothing).
  await setAiBudgetCents(1);
  const at = new Date();
  const usage = { ...NO_USAGE, inputTokens: 1_200, outputTokens: 300 };
  const call = { at, durationMs: 900, feature: 'resume-match' as const, viaFallback: false, jobId: job.job.id, resumeId: resume.id };
  await recordAiCall({ ...call, engine: 'anthropic_api', model: 'claude-opus-5', outcome: 'ok', billing: 'billed', spend: { usage, model: 'claude-opus-5', reportedUsd: null } });
  await recordAiCall({ ...call, engine: 'claude_code', model: 'claude-sonnet-5', outcome: 'ok', billing: 'plan', spend: { usage, model: 'claude-sonnet-5', reportedUsd: 0.004 } });
  await recordAiCall({ ...call, engine: 'openai_api', model: 'qwen2.5:14b', outcome: 'ok', billing: 'local', spend: { usage, model: 'qwen2.5:14b', reportedUsd: null } });
  await recordAiCall({ ...call, engine: 'openai_api', model: 'mystery-model', outcome: 'ok', billing: 'billed', spend: { usage, model: 'mystery-model', reportedUsd: null } });
  await recordAiCall({ ...call, engine: 'anthropic_api', model: 'claude-opus-5', outcome: 'timeout', billing: 'billed', spend: null });
  // One stored comparison, so the job page and the targeted view draw a keyword
  // table — the keyword matcher (a browser module imported by file URL) loads
  // on every OS the smoke runs on.
  const reply = parseMatchResponse(
    JSON.stringify({
      summary: 'Primary stack 2/2: Node.js and TypeScript present.',
      alignment: { title: 'strong', summary: 'strong', recent_role: 'strong' },
      keywords: [
        { term: 'Node.js', priority: 1, requirement: 'must', primary: true, status: 'present', aliases: ['node'], where: 'skills', note: null },
        { term: 'TypeScript', priority: 1, requirement: 'must', primary: true, status: 'present', aliases: [], where: 'skills', note: null },
        { term: 'PostgreSQL', priority: 2, requirement: 'must', primary: false, status: 'present', aliases: ['postgres'], where: 'skills', note: null, aliasOnly: 'Postgres' },
      ],
    }),
  );
  if (!reply.ok) throw new Error(`smoke fixture: ${reply.error}`);
  await createMatch({
    jobId: job.job.id,
    resumeId: resume.id,
    resumeVersion: resume.version,
    resumeText: RESUME,
    resumeName: 'Smoke resume',
    draft: false,
    model: 'smoke',
    result: reply.data,
    breakdown: scoreMatch(reply.data.keywords, reply.data.alignment, 0),
    promptVersion: PROMPT_VERSION,
    mode: 'full',
    frame: 'first-run',
    verificationId: null,
    evidence: 'own',
  });
  const browserPage = await prisma.company.create({
    data: { name: 'Smoke Page', atsType: 'BROWSER_PAGE', atsToken: 'https://smoke.example/careers', watched: true, active: false },
  });
  return {
    jobId: job.job.id,
    companyId: job.job.companyId,
    resumeId: resume.id,
    screeningId: screening.id,
    applicantId: applicant.id,
    browserPageId: browserPage.id,
  };
}

/** A route pattern with its params filled from the fixtures. */
function fill(path: string, f: Fixtures): string {
  const id =
    path.startsWith('/jobs/') ? f.jobId
    : path.startsWith('/resumes/') ? f.resumeId
    : path.startsWith('/screen/') ? f.screeningId
    : path.startsWith('/companies/watchlist/') ? 'gone'
    : path.startsWith('/companies/') ? f.companyId
    : 'gone';
  return path
    .replace(':aid', String(f.applicantId))
    .replace(':letterId', '1')
    .replace(':lid', '1')
    .replace(':matchId', '1')
    .replace(':index', '0')
    .replace(':fmt', 'pdf')
    .replace(':key', 'applied')
    .replace(':id', String(id));
}

/** The flash a redirect carries, as text. */
function flashOf(res: Response): string {
  return parseFlashCookie((res.headers.get('set-cookie') ?? '').split(';')[0])?.text ?? '';
}

function form(fields: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { ...ORIGIN, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  };
}

async function main(): Promise<void> {
  const f = await fixtures();
  const gets = [...new Set(app.routes.filter((r) => r.method === 'GET' && !r.path.includes('*')).map((r) => r.path))].sort();

  const rows: { route: string; url: string; status: number; ok: boolean }[] = [];
  for (const route of gets) {
    const url = fill(route, f);
    const res = await app.request(url, { headers: ORIGIN });
    const ok = ACCEPT.has(res.status) || (res.status === 404 && MAY_404.has(route));
    rows.push({ route, url, status: res.status, ok });
  }
  for (const url of QUERY_VARIANTS.map((v) => fill(v, f))) {
    const res = await app.request(url, { headers: ORIGIN });
    rows.push({ route: url, url, status: res.status, ok: res.status === 200 });
  }

  // The writes a first run makes, through the same guard a browser meets.
  const posts: { name: string; init: RequestInit; expect: (res: Response) => boolean | Promise<boolean> }[] = [
    {
      name: 'POST /jobs/new (a pasted posting)',
      init: form({ companyName: 'Smoke Two', title: 'Platform Engineer', url: '', location: 'Berlin', description: POSTING }),
      expect: (res) => res.status === 303 && /^\/jobs\/\d+/.test(res.headers.get('location') ?? ''),
    },
    {
      name: 'POST /resumes (a .txt upload)',
      init: (() => {
        const body = new FormData();
        body.set('name', 'Smoke upload');
        body.set('file', new File([`${RESUME}\nLanguages: English, Ukrainian.`], 'smoke.txt', { type: 'text/plain' }));
        return { method: 'POST', headers: ORIGIN, body } satisfies RequestInit;
      })(),
      expect: (res) => res.status === 303 && (res.headers.get('location') ?? '').startsWith('/target/runs/'),
    },
    {
      // TASKS R16: the fixture's own text again is the resume already there — no second row, no scan.
      name: 'POST /resumes with the text of a saved resume (sent to it)',
      init: (() => {
        const body = new FormData();
        body.set('file', new File([RESUME], 'again.txt', { type: 'text/plain' }));
        return { method: 'POST', headers: ORIGIN, body } satisfies RequestInit;
      })(),
      expect: (res) => res.status === 303 && res.headers.get('location') === `/resumes/${f.resumeId}`,
    },
    {
      // TASKS R14: the same resume as another file, read beside the saved one — a page, nothing stored.
      name: 'POST /resumes/:id/compare-format (the same resume as another file)',
      init: (() => {
        const body = new FormData();
        body.set('file', new File([`${RESUME}\nCertificates: AWS Solutions Architect.`], 'smoke.md', { type: 'text/markdown' }));
        return { method: 'POST', headers: ORIGIN, body } satisfies RequestInit;
      })(),
      expect: (res) => res.status === 200 && (res.headers.get('content-type') ?? '').includes('text/html'),
    },
    {
      // TASKS H23/H25 + E4: one upload decided whole and written in one transaction — a repeat
      // of the fixture skipped, a new resume added, and one whose phone digits survive the
      // redaction held for a look before any model reads it.
      name: 'POST /screen/:id/applicants (a repeat, a new file, a leak held)',
      init: (() => {
        const body = new FormData();
        body.append('files', new File([RESUME], 'again.txt', { type: 'text/plain' }));
        body.append('files', new File([`${RESUME.replace('Jane Example', 'Mark Sample')}\nAlso built the invoicing API.`], 'mark.txt', { type: 'text/plain' }));
        body.append(
          'files',
          new File([`Olena Test — QA Engineer. Phone +380 67 123 45 67.\n${RESUME.replace('Jane Example', 'Olena Test')}\nOrder ref 38067x1234567.`], 'olena.txt', { type: 'text/plain' }),
        );
        // Two copies of one file no text comes out of: one unreadable row, the copy skipped — not a unique-key 500.
        body.append('files', new File(['x'], 'scan-a.txt', { type: 'text/plain' }));
        body.append('files', new File(['x'], 'scan-b.txt', { type: 'text/plain' }));
        // TASKS E3: a cover letter goes to its person (the file name's stem is Mark's), never scored; one with nobody's resume is left out.
        const letter = (who: string) =>
          `Dear Hiring Team,\n\nI would like to apply for the backend role. At Acme I built the billing service in Node.js and TypeScript, moved it from MySQL to PostgreSQL and cut p95 latency by 40%. I would bring the same care for the details to your scheduling product.\n\nKind regards,\n${who}`;
        body.append('files', new File([letter('Mark')], 'mark_cover_letter.txt', { type: 'text/plain' }));
        body.append('files', new File([letter('Zed')], 'Zed_Cover_Letter.txt', { type: 'text/plain' }));
        // Only its words call this one a letter and nobody's resume came with it: it may be a polite resume, so it is added as one.
        body.append('files', new File([letter('Quinn')], 'quinn.txt', { type: 'text/plain' }));
        return { method: 'POST', headers: ORIGIN, body } satisfies RequestInit;
      })(),
      expect: (res) => {
        const flash = flashOf(res);
        return (
          res.status === 303 &&
          flash.includes('3 applicants added') &&
          flash.includes('2 files already added') &&
          flash.includes('1 held for a look') &&
          flash.includes('1 file could not be read') &&
          flash.includes('1 cover letter attached') &&
          flash.includes('1 cover letter left out')
        );
      },
    },
    {
      name: 'POST /settings/fetching-toggle',
      init: form({}),
      expect: (res) => res.status === 303,
    },
    {
      name: 'POST /jobs/:id/status from another origin (refused)',
      init: { method: 'POST', headers: { origin: 'http://evil.example', host: 'localhost', 'content-type': 'application/x-www-form-urlencoded' }, body: 'status=SAVED' },
      expect: (res) => res.status === 403,
    },
    {
      // ADR 0071: no Google client in this environment, so the card says it is not set up and offers no Connect.
      name: 'GET /settings?tab=profile (the Gmail card, on an install with no Google client)',
      init: { method: 'GET', headers: ORIGIN },
      expect: async (res) => {
        const html = res.status === 200 ? await res.text() : '';
        return html.includes('id="gmail"') && html.includes('Gmail is not set up on this install') && !html.includes('/gmail/connect');
      },
    },
    {
      name: 'GET /gmail/connect with no Google client (says so, goes nowhere)',
      init: { method: 'GET', headers: ORIGIN },
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=profile#gmail' && flashOf(res).includes('not set up'),
    },
    {
      name: 'POST /gmail/check with no connection (told so)',
      init: form({}),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=profile#gmail' && flashOf(res).includes('not connected'),
    },
    {
      name: 'POST /gmail/label with no connection (told so)',
      init: form({ label: 'Job Leads' }),
      expect: (res) => res.status === 303 && flashOf(res).includes('not connected'),
    },
    {
      name: 'POST /gmail/disconnect with no connection (told so, nothing deleted)',
      init: form({}),
      expect: (res) => res.status === 303 && flashOf(res).includes('not connected'),
    },
    {
      name: 'POST /gmail/disconnect from another origin (refused)',
      init: { method: 'POST', headers: { origin: 'http://evil.example', host: 'localhost', 'content-type': 'application/x-www-form-urlencoded' }, body: '' },
      expect: (res) => res.status === 403,
    },
    {
      // The rail rides on every tab: a status change made on one returns to it, and only a known tab is echoed.
      name: 'POST /jobs/:id/status with tab=match (back to that tab)',
      init: form({ status: 'SAVED', tab: 'match' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === `/jobs/${f.jobId}?tab=match`,
    },
    {
      name: 'POST /jobs/:id/status with a made-up tab (back to the posting)',
      init: form({ status: 'NEW', tab: 'https://evil.example' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === `/jobs/${f.jobId}`,
    },
    {
      name: 'POST /facts (not sure)',
      init: form({ term: 'Kubernetes', decision: 'unknown', back: '/resumes' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/resumes',
    },
    {
      name: 'POST /settings/ai/budget',
      init: form({ budget: '12.50' }),
      expect: (res) => res.status === 303 && (res.headers.get('location') ?? '').startsWith('/settings?tab=ai'),
    },
    {
      // TASKS N8: the text of a page drawn in the browser, read into lines.
      name: 'POST /companies/:id/paste',
      init: form({ page: 'Acme careers\nSenior Backend Engineer (Remote)\nSales Manager' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/companies#browser-pages',
    },
    {
      // ADR 0056: the pasted company above, muted from its posting's rail.
      name: 'POST /companies/mutes',
      init: form({ name: 'Smoke Two', reason: 'smoke', back: '/jobs' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/jobs',
    },
    {
      name: 'GET /jobs with a company muted (the hiding clause and its count)',
      init: { method: 'GET', headers: ORIGIN },
      expect: (res) => res.status === 200,
    },
    {
      name: 'POST /companies/mutes/delete',
      init: form({ key: 'smoke two', back: '/companies#muted' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/companies#muted',
    },
    {
      name: 'POST /settings/reapply',
      init: form({ days: '90' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=applications#reapply',
    },
    {
      // The schedule is three forms on three tabs: each saves its own part and keeps the stored rest.
      name: 'POST /settings/schedule (alert timing, from Notifications)',
      init: form({ part: 'alerts', alertMode: 'digest', alertFrom: '9', alertTo: '18', alertDays: '1', digestAt: '8' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=notifications#alerts',
    },
    {
      // The daily summary's time pickers: an empty one ("—") is no hour, never 00:00.
      name: 'POST /settings/schedule (summary times with an empty picker)',
      init: { method: 'POST', headers: { ...ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: 'part=alerts&alertMode=digest&alertFrom=9&alertTo=18&alertDays=1&digestAt=8&digestAt=&digestAt=18&digestAt=' },
      expect: async (res) => {
        const stored = (await getSettings()).schedule as { alerts?: { digestAt?: number[] } } | null;
        return res.status === 303 && stored?.alerts?.digestAt?.join() === '8,18';
      },
    },
    {
      name: 'POST /settings/schedule (when to search, from Job search: the alert timing stays)',
      init: form({ part: 'fetch', fetchEvery: '2h', fetchFrom: '6', fetchTo: '22', fetchDays: '2' }),
      expect: async (res) => {
        const stored = (await getSettings()).schedule as { fetch?: { every?: string }; alerts?: { mode?: string; digestAt?: number[] } } | null;
        return (
          res.status === 303 &&
          res.headers.get('location') === '/settings?tab=profile#schedule' &&
          stored?.fetch?.every === '2h' &&
          stored.alerts?.mode === 'digest' &&
          stored.alerts.digestAt?.join() === '8,18'
        );
      },
    },
    {
      name: 'POST /settings/schedule (the time zone, from General: the hours stay)',
      init: form({ part: 'zone', timezone: 'Europe/Kyiv' }),
      expect: async (res) => {
        const stored = (await getSettings()).schedule as { timezone?: string; fetch?: { every?: string }; alerts?: { mode?: string } } | null;
        return (
          res.status === 303 &&
          res.headers.get('location') === '/settings?tab=general#timezone' &&
          stored?.timezone === 'Europe/Kyiv' &&
          stored.fetch?.every === '2h' &&
          stored.alerts?.mode === 'digest'
        );
      },
    },
    {
      // TASKS S1: the OpenAI-compatible engine's server, set here; one on this machine takes no key.
      name: 'POST /settings/ai/openai-base',
      init: form({ baseUrl: 'http://127.0.0.1:9/v1' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=ai',
    },
    {
      name: 'GET /settings?tab=ai with a local server that does not answer',
      init: { method: 'GET', headers: ORIGIN },
      expect: (res) => res.status === 200,
    },
    {
      name: 'POST /welcome/ai/local with nothing answering (nothing changes)',
      init: form({ base: 'http://127.0.0.1:9/v1', model: 'llama3.1:8b' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/welcome?step=ai',
    },
    {
      // TASKS S5: no launcher here, so the login entry is refused and nothing is written.
      name: 'POST /settings/login-item without the launcher (refused)',
      init: form({ on: '1' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=general#login',
    },
    {
      // ADR 0057: the local engine's Ollama root and its context window.
      name: 'POST /settings/ai/local (an address)',
      init: form({ baseUrl: 'http://127.0.0.1:9/v1' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=ai',
    },
    {
      name: 'POST /settings/ai/local (the context window)',
      init: form({ contextTokens: '32768' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=ai',
    },
    {
      name: 'POST /settings/ai/local clear=1 (back to .env)',
      init: form({ clear: '1' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=ai',
    },
    {
      name: 'POST /settings/ai/openai-base clear=1 (back to .env)',
      init: form({ clear: '1' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=ai',
    },
    {
      // The one route that reads files beside dist/: the PDF fonts a build must copy.
      name: 'POST /resumes/:id/render (a clean PDF)',
      init: form({ mode: 'pdf' }),
      expect: (res) => res.status === 200 && res.headers.get('content-type') === 'application/pdf',
    },
    {
      // The Tailor page's document pane: the draft drawn as a file, nothing stored.
      name: 'POST /resumes/:id/document (the draft as a document)',
      init: form({ text: `${RESUME}\n- Shipped a notification service.`, baseText: RESUME }),
      expect: (res) => res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('application/json'),
    },
    {
      name: 'POST /resumes/:id/document as=docx (the download)',
      init: form({ text: RESUME, baseText: RESUME, as: 'docx' }),
      expect: (res) => res.status === 200 && /attachment; filename=/.test(res.headers.get('content-disposition') ?? ''),
    },
    {
      name: 'POST /resumes/:id/document as=pdf (the clean PDF of the draft)',
      init: form({ text: RESUME, baseText: RESUME, as: 'pdf' }),
      expect: (res) => res.status === 200 && res.headers.get('content-type') === 'application/pdf',
    },
    {
      // ADR 0061: the switcher returns to the page it was pressed on, and says so in the language chosen.
      name: 'POST /settings/locale (Ukrainian, back to the page it was pressed on)',
      init: form({ locale: 'uk', back: '/jobs?status=NEW' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/jobs?status=NEW' && flashOf(res).includes('Інтерфейс тепер українською'),
    },
    {
      name: 'GET /jobs in Ukrainian (the page says which language it is in, and the menu speaks it)',
      init: { method: 'GET', headers: ORIGIN },
      expect: async (res) => {
        const html = res.status === 200 ? await res.text() : '';
        return html.includes('<html lang="uk">') && html.includes('Вакансії');
      },
    },
    {
      name: 'POST /settings/locale with a language nobody offers (refused, in the language in use)',
      init: form({ locale: 'en-XA' }),
      expect: (res) => res.status === 303 && flashOf(res).includes('нічого не змінилося'),
    },
    {
      name: 'POST /settings/locale (English, a way back that leaves the site ignored)',
      init: form({ locale: 'en', back: '//evil.example/jobs' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=general#language' && flashOf(res).includes('The interface is in English'),
    },
    {
      // The appearance switch: a cookie in the browser, no row in the database.
      name: 'POST /settings/theme (Dark, back to the page it was pressed on)',
      init: form({ theme: 'dark', back: '/jobs?status=NEW' }),
      expect: (res) => {
        const cookie = res.headers.get('set-cookie') ?? '';
        return res.status === 303 && res.headers.get('location') === '/jobs?status=NEW' && /^theme=dark;/.test(cookie) && /HttpOnly/i.test(cookie);
      },
    },
    {
      name: 'GET /jobs with the dark cookie (the page is in the dark look from its first byte)',
      init: { method: 'GET', headers: { ...ORIGIN, cookie: 'theme=dark' } },
      expect: async (res) => res.status === 200 && (await res.text()).includes('<html lang="en" data-theme="dark">'),
    },
    {
      name: 'GET /jobs with a cookie that is not a look (System: no data-theme)',
      init: { method: 'GET', headers: { ...ORIGIN, cookie: 'theme=blue' } },
      expect: async (res) => res.status === 200 && (await res.text()).includes('<html lang="en">'),
    },
    {
      name: 'POST /settings/theme (System removes the cookie)',
      init: form({ theme: 'system' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/' && /^theme=;.*Max-Age=0/i.test(res.headers.get('set-cookie') ?? ''),
    },
    {
      name: 'POST /settings/theme with a look nobody offers (nothing set, back where it came from)',
      init: form({ theme: 'blue', back: '//evil.example/' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === '/' && !res.headers.has('set-cookie'),
    },
    {
      // ADR 0063: the settings form as a browser sends it — an unticked box absent, the sections repeated.
      name: 'POST /settings/pack (packs switched on)',
      init: { method: 'POST', headers: { ...ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: 'enabled=1&minFit=92&dailyLimit=0&maxAgeDays=14&coverLetter=asked&sections=title&sections=skills&maxBullets=1&keywords=1' },
      expect: (res) => res.status === 303 && res.headers.get('location') === '/settings?tab=automation#packs',
    },
    {
      name: 'GET /settings?tab=automation (the saved pack settings drawn)',
      init: { headers: ORIGIN },
      expect: (res) => res.status === 200,
    },
    {
      // #383: a value the form does not offer was stored as the default and reported as saved. It stores nothing now —
      // not the other fields, not the unticked switch — and the flash names the field for the page to mark.
      name: 'POST /settings/pack with a fit the form does not offer (refused, the field named, nothing stored)',
      init: { method: 'POST', headers: { ...ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: 'minFit=40&dailyLimit=3&maxAgeDays=14&coverLetter=asked&maxBullets=1' },
      expect: async (res) => {
        const flash = parseFlashCookie((res.headers.get('set-cookie') ?? '').split(';')[0]);
        const stored = await getPackSettings(DEFAULT_USER_ID);
        return (
          res.status === 303 &&
          res.headers.get('location') === '/settings?tab=automation#packs' &&
          flash?.kind === 'err' &&
          flash.field?.form === '/settings/pack' &&
          flash.field.name === 'minFit' &&
          stored.enabled &&
          stored.minFit === 92 &&
          stored.dailyLimit === 0
        );
      },
    },
    {
      // The dashboard only queues; the worker prepares. With no worker here the row stays queued.
      name: 'POST /jobs/:id/pack (queued for the worker)',
      init: form({}),
      expect: (res) => res.status === 303 && res.headers.get('location') === `/jobs/${f.jobId}?tab=pack`,
    },
    {
      name: 'POST /jobs/:id/pack again (already queued, not a second row)',
      init: form({}),
      expect: (res) => res.status === 303 && res.headers.get('location') === `/jobs/${f.jobId}?tab=pack`,
    },
    {
      // The tab asks for the pack's state instead of reloading; a browser with no script gets the reload.
      name: 'GET /jobs/:id?tab=pack (a queued pack: the tab polls, a refresh only without script)',
      init: { headers: ORIGIN },
      expect: async (res) => {
        const html = res.status === 200 ? await res.text() : '';
        return html.includes('/static/pack-tab.mjs') && html.includes('<noscript><meta http-equiv="refresh"') && !/<head>(?:(?!<noscript>)[\s\S])*?<meta http-equiv="refresh"/.test(html.slice(0, html.indexOf('</head>')));
      },
    },
    {
      name: 'GET /jobs/:id/pack/state (a queued pack: busy, with its line)',
      init: { headers: ORIGIN },
      expect: async (res) => {
        const state = res.status === 200 ? ((await res.json()) as { busy?: unknown; line?: unknown; wait?: unknown }) : {};
        return state.busy === true && typeof state.line === 'string' && state.line.length > 0 && typeof state.wait === 'string';
      },
    },
    {
      // "I sent this file" from a page whose pack is no longer ready: nothing is recorded or frozen, and the pack tab says why.
      name: 'POST /jobs/:id/status naming a pack that is not ready (refused, nothing recorded)',
      init: form({ status: 'APPLIED', appliedResumeId: 'pack-1', tab: 'pack' }),
      expect: (res) => res.status === 303 && res.headers.get('location') === `/jobs/${f.jobId}?tab=pack` && (res.headers.get('set-cookie') ?? '').includes('flash='),
    },
  ];
  const postPaths = [
    '/jobs/new',
    '/resumes',
    '/resumes',
    `/resumes/${f.resumeId}/compare-format`,
    `/screen/${f.screeningId}/applicants`,
    '/settings/fetching-toggle',
    `/jobs/${f.jobId}/status`,
    // The Gmail steps (ADR 0071), in the order they sit in `posts`.
    '/settings?tab=profile',
    '/gmail/connect',
    '/gmail/check',
    '/gmail/label',
    '/gmail/disconnect',
    '/gmail/disconnect',
    `/jobs/${f.jobId}/status`,
    `/jobs/${f.jobId}/status`,
    '/facts',
    '/settings/ai/budget',
    `/companies/${f.browserPageId}/paste`,
    '/companies/mutes',
    '/jobs',
    '/companies/mutes/delete',
    '/settings/reapply',
    '/settings/schedule',
    '/settings/schedule',
    '/settings/schedule',
    '/settings/schedule',
    '/settings/ai/openai-base',
    '/settings?tab=ai',
    '/welcome/ai/local',
    '/settings/login-item',
    '/settings/ai/local',
    '/settings/ai/local',
    '/settings/ai/local',
    '/settings/ai/openai-base',
    `/resumes/${f.resumeId}/render`,
    `/resumes/${f.resumeId}/document`,
    `/resumes/${f.resumeId}/document`,
    `/resumes/${f.resumeId}/document`,
    '/settings/locale',
    '/jobs',
    '/settings/locale',
    '/settings/locale',
    '/settings/theme',
    '/jobs',
    '/jobs',
    '/settings/theme',
    '/settings/theme',
    '/settings/pack',
    '/settings?tab=automation',
    '/settings/pack',
    `/jobs/${f.jobId}/pack`,
    `/jobs/${f.jobId}/pack`,
    `/jobs/${f.jobId}?tab=pack`,
    `/jobs/${f.jobId}/pack/state`,
    `/jobs/${f.jobId}/status`,
  ];
  for (const [i, p] of posts.entries()) {
    const res = await app.request(postPaths[i]!, p.init);
    rows.push({ route: p.name, url: postPaths[i]!, status: res.status, ok: await p.expect(res) });
  }

  // What a request gets WRONG. Every one of these used to be a 500 or worse,
  // and a 500 anywhere fails the build — so the negative paths need naming
  // as explicitly as the happy ones.
  const negatives: { name: string; url: string; init: RequestInit; expect: (res: Response) => boolean }[] = [
    {
      name: 'GET /jobs/:id with a non-numeric id (400, not a crash)',
      url: '/jobs/not-a-number',
      init: { headers: ORIGIN },
      expect: (res) => res.status === 400 || res.status === 404,
    },
    {
      name: 'GET /jobs/:id that does not exist (404)',
      url: '/jobs/99999999',
      init: { headers: ORIGIN },
      expect: (res) => res.status === 404,
    },
    {
      name: 'POST a body that is not the multipart it claims (400)',
      url: '/resumes',
      init: {
        method: 'POST',
        headers: { ...ORIGIN, 'content-type': 'multipart/form-data; boundary=----smoke' },
        body: 'this is not multipart at all',
      },
      expect: (res) => res.status === 400,
    },
    {
      name: 'POST /settings/theme from another site (refused, no cookie)',
      url: '/settings/theme',
      init: {
        method: 'POST',
        headers: { origin: 'https://evil.example', host: 'localhost', 'content-type': 'application/x-www-form-urlencoded' },
        body: 'theme=dark',
      },
      expect: (res) => res.status === 403 && !res.headers.has('set-cookie'),
    },
    {
      // Just over DEFAULT_BODY_BYTES, not a round number of megabytes: the
      // point is the ceiling, and CI should not build a 30 MB string to
      // prove it.
      name: 'POST a body past the size limit (413)',
      url: '/jobs/new',
      init: {
        method: 'POST',
        headers: { ...ORIGIN, 'content-type': 'application/x-www-form-urlencoded' },
        body: `description=${'x'.repeat(DEFAULT_BODY_BYTES + 1024)}`,
      },
      expect: (res) => res.status === 413,
    },
  ];
  for (const n of negatives) {
    const res = await app.request(n.url, n.init);
    rows.push({ route: n.name, url: n.url, status: res.status, ok: n.expect(res) });
  }

  // The same posting pasted twice at once: the unique key settles it and BOTH
  // requests get an answer, rather than the loser reading on an aborted
  // transaction and returning a 500.
  const twice = {
    companyName: 'Smoke Race',
    title: 'Race Engineer',
    url: '',
    location: 'Berlin',
    description: POSTING,
  };
  const raced = await Promise.all([app.request('/jobs/new', form(twice)), app.request('/jobs/new', form(twice))]);
  rows.push({
    route: 'POST /jobs/new twice at once (both 303)',
    url: '/jobs/new',
    status: raced[0]!.status,
    ok: raced.every((r) => r.status === 303 && /^\/jobs\/\d+/.test(r.headers.get('location') ?? '')),
  });

  // "Fetch now" while another fetch holds the lock, as the worker's tick
  // would: the run is accepted and does nothing — no source read, no alert,
  // no AI — because two at once would score the same postings twice.
  const held = await tryFetchLock();
  if (!held) throw new Error('route smoke: the fetch lock is already taken');
  try {
    const started = await app.request('/runs/fetch-now', form({}));
    const runId = (started.headers.get('location') ?? '').split('/').pop() ?? '';
    const run = await settled(() => getFetchRun(runId));
    rows.push({
      route: 'POST /runs/fetch-now while another fetch holds the lock (overlap)',
      url: '/runs/fetch-now',
      status: started.status,
      ok: started.status === 303 && run?.stats?.reason === 'overlap',
    });
  } finally {
    await held.release();
  }

  rows.push(...(await importChecks()));
  rows.push(...(await isolationChecks(f.jobId)));
  rows.push(...(await resumeIsolationChecks(f.resumeId)));
  rows.push(...(await notificationIsolationChecks()));
  rows.push(...(await roleSweep(f)));
  rows.push(...(await folderChecks()));
  rows.push(await packAgainCheck(f.jobId));
  rows.push(await packCancelCheck(f.jobId));
  rows.push(...(await engineTroubleChecks()));

  // The Overview itself. A fresh database sends `/` to /welcome, so until here
  // the dashboard was never drawn: setup is skipped, a scored match and a day
  // of the funnel are put in place, and the page is asked under every range of
  // its chart, under a technology, and under values nobody offers.
  await prisma.company.create({
    data: {
      name: 'Smoke Stats',
      atsType: 'MANUAL',
      atsToken: 'smoke-stats',
      active: false,
      jobs: {
        create: {
          externalId: 'smoke-match',
          title: 'Node Engineer',
          url: '',
          location: 'Remote',
          description: POSTING,
          postedAt: new Date(),
          userJobs: { create: { userId: DEFAULT_USER_ID, status: 'ALERTED', fitScore: 88, alertedAt: new Date(), techMatch: ['node.js', 'typescript'] } },
        },
      },
    },
  });
  await addToFunnel(new Date(), { fetched: 40, filterRejected: 30, duplicate: 2, classified: 8, matched: 1, alerted: 1 });
  const skipped = await app.request('/welcome/skip', form({}));
  rows.push({ route: 'POST /welcome/skip (setup skipped)', url: '/welcome/skip', status: skipped.status, ok: skipped.status === 303 });
  for (const url of OVERVIEW_VARIANTS) {
    const res = await app.request(url, { headers: ORIGIN });
    const html = res.status === 200 ? await res.text() : '';
    rows.push({
      route: `GET ${url} (the Overview, with its chart)`,
      url,
      status: res.status,
      ok: res.status === 200 && html.includes('data-plot') && html.includes('Node.js'),
    });
  }

  const pseudo = await pseudoPass([...gets, ...PSEUDO_VARIANTS].map((route) => fill(route, f)));
  rows.push(...pseudo.rows);

  const failed = rows.filter((r) => !r.ok);
  const width = Math.max(...rows.map((r) => r.route.length));
  for (const r of rows) console.log(`${r.ok ? 'ok ' : 'FAIL'}  ${r.status}  ${r.route.padEnd(width)}  ${r.url}`);
  console.log(`\n${rows.length} requests, ${rows.length - failed.length} as expected, ${failed.length} failed`);
  console.log(pseudo.report);
  await prisma.$disconnect();
  // A background scan the upload started may still hold a child; the answer is in.
  process.exit(failed.length > 0 ? 1 : 0);
}

const IMPORT_CSV = [
  'Position,Organisation,Job link,Where,About the role,Recruiter email',
  'Backend Developer,Smoke Imports,https://rows.example/jobs/1,Remote,"Owns the ledger service, end to end.",someone@rows.example',
  'Mobile Developer,Smoke Imports,https://rows.example/jobs/2,Lisbon,Owns the offline queue.,someone@rows.example',
  'QA Engineer,Other Smoke,https://rows.example/jobs/3,Porto,Tests both.,other@rows.example',
  ',Other Smoke,https://rows.example/jobs/4,Porto,A row with no title.,other@rows.example',
].join('\r\n');
const IMPORT_MAPPING = { title: 'Position', employer: 'Organisation', url: 'Job link', location: 'Where', description: 'About the role' };

type Check = { route: string; url: string; status: number; ok: boolean };

/**
 * Two people on one install (ADR 0067): a posting is shared and what each
 * does with it is their own. The second person goes through the same guard,
 * routes and readers as a signed-in session would.
 */
async function isolationChecks(ownJobId: number): Promise<Check[]> {
  const out: Check[] = [];
  const add = (route: string, url: string, status: number, ok: boolean): void => {
    out.push({ route, url, status, ok });
  };
  const teammate = await prisma.user.create({ data: { oidcSub: 'smoke-teammate', name: 'Smoke teammate', role: 'MEMBER' } });
  await ensurePrimaryProfile(teammate.id);
  const posting = (externalId: string, title: string) => ({ externalId, title, url: '', location: 'Remote', description: POSTING, postedAt: new Date() });
  const company = await prisma.company.create({
    data: {
      name: 'Isolation Co',
      atsType: 'MANUAL',
      atsToken: 'isolation-co',
      active: false,
      jobs: { create: [posting('shared', 'Isolation Shared'), posting('theirs', 'Isolation Theirs')] },
    },
    include: { jobs: true },
  });
  const shared = company.jobs.find((j) => j.externalId === 'shared')!;
  const theirs = company.jobs.find((j) => j.externalId === 'theirs')!;
  await prisma.userJob.createMany({
    data: [
      { userId: DEFAULT_USER_ID, jobId: shared.id, status: 'NEW', fitScore: 90 },
      { userId: teammate.id, jobId: shared.id, status: 'NEW', fitScore: 61 },
      { userId: teammate.id, jobId: theirs.id, status: 'NEW', fitScore: 75 },
    ],
  });
  const asTeammate = new Hono();
  asTeammate.use('*', async (c, next) => {
    c.set('session', { sub: 'smoke-teammate', name: teammate.name, uid: teammate.id, exp: 9_999_999_999 });
    return next();
  });
  asTeammate.use('*', withCurrentUser(loadUser));
  asTeammate.use('/jobs/*', requireHeldJob());
  asTeammate.route('/', jobsRoute);
  asTeammate.route('/', applicationsRoute);

  const list = await asTeammate.request('/jobs', { headers: ORIGIN });
  const html = await list.text();
  add('GET /jobs for a second person (their postings only)', '/jobs', list.status, list.status === 200 && html.includes('Isolation Theirs') && html.includes('Isolation Shared') && !html.includes('Backend Engineer'));
  const mine = await asTeammate.request(`/jobs/${ownJobId}`, { headers: ORIGIN });
  add('GET /jobs/:id of a posting the second person does not hold (not found)', `/jobs/${ownJobId}`, mine.status, mine.status === 404);
  const owner = await app.request(`/jobs/${theirs.id}`, { headers: ORIGIN });
  add('GET /jobs/:id of a posting only the other person holds (not found for the owner)', `/jobs/${theirs.id}`, owner.status, owner.status === 404);
  const applied = await asTeammate.request(`/jobs/${shared.id}/status`, form({ status: 'APPLIED' }));
  const rows = await prisma.userJob.findMany({ where: { jobId: shared.id }, orderBy: { userId: 'asc' } });
  add(
    'POST /jobs/:id/status by one person leaves the other person\'s row alone',
    `/jobs/${shared.id}/status`,
    applied.status,
    applied.status === 303 && rows.find((r) => r.userId === DEFAULT_USER_ID)?.status === 'NEW' && rows.find((r) => r.userId === teammate.id)?.status === 'APPLIED',
  );
  const board = await asTeammate.request('/applications', { headers: ORIGIN });
  const boardHtml = await board.text();
  add('GET /applications for a second person (their application only)', '/applications', board.status, board.status === 200 && boardHtml.includes('Isolation Shared'));
  const ownerBoard = await app.request('/applications', { headers: ORIGIN });
  add('GET /applications for the owner (not the other person\'s application)', '/applications', ownerBoard.status, ownerBoard.status === 200 && !(await ownerBoard.text()).includes('Isolation Shared'));
  const foreign = await asTeammate.request(`/jobs/${ownJobId}/status`, form({ status: 'DISMISSED' }));
  add('POST /jobs/:id/status on a posting the second person does not hold (not found)', `/jobs/${ownJobId}/status`, foreign.status, foreign.status === 404);
  return out;
}

/**
 * Notifications, mutes and personal settings (ADR 0069), for the second person
 * made by isolationChecks: their own destinations, switches, mutes, schedule
 * and language; a held alert, a recap and a notice reach only the owning
 * person's chat (Telegram is a recording stub for the length of the check),
 * and neither person reads or changes the other's.
 */
async function notificationIsolationChecks(): Promise<Check[]> {
  const out: Check[] = [];
  const add = (route: string, url: string, status: number, ok: boolean): void => {
    out.push({ route, url, status, ok });
  };
  const teammate = await prisma.user.findUniqueOrThrow({ where: { oidcSub: 'smoke-teammate' } });
  const ownerBefore = await getUserSettings(DEFAULT_USER_ID);
  // The checks above leave the owner's alerts on a digest; delivery below is asked in the instant mode.
  const ownerSchedule = await getAlertSchedule(DEFAULT_USER_ID);
  await setPersonalSchedule(DEFAULT_USER_ID, { ...ownerSchedule, alerts: { ...ownerSchedule.alerts, mode: 'instant' } });
  const ownerTarget = await addNotificationTarget(DEFAULT_USER_ID, { kind: 'TELEGRAM', name: 'Owner chat', botToken: 'owner-token', chatId: 'owner-chat' });
  const mateTarget = await addNotificationTarget(teammate.id, { kind: 'TELEGRAM', name: 'Mate chat', botToken: 'mate-token', chatId: 'mate-chat' });
  if (!ownerTarget || !mateTarget) throw new Error('smoke: notification targets were not created');
  // Even the same bot and chat may be two people's.
  const sameChat = await addNotificationTarget(teammate.id, { kind: 'TELEGRAM', name: 'Owner chat again', botToken: 'owner-token', chatId: 'owner-chat' });
  add('the same bot and chat can be added by a second person (unique per person)', '(store)', 200, sameChat !== null);
  if (sameChat) await deleteNotificationTarget(teammate.id, sameChat.id);

  const person = (user: { id: number; name: string }, sub: string) => {
    const a = new Hono();
    a.use('*', async (c, next) => {
      c.set('session', { sub, name: user.name, uid: user.id, exp: 9_999_999_999 });
      return next();
    });
    a.use('*', withCurrentUser(loadUser));
    a.route('/', settingsRoute);
    a.route('/', companiesRoute);
    return a;
  };
  const asMate = person(teammate, 'smoke-teammate');

  // The destinations on the Notifications tab.
  const mateTab = await asMate.request('/settings?tab=notifications', { headers: ORIGIN });
  const mateHtml = await mateTab.text();
  add('GET /settings?tab=notifications for a second person (their chats only)', '/settings?tab=notifications', mateTab.status, mateTab.status === 200 && mateHtml.includes('Mate chat') && !mateHtml.includes('Owner chat'));
  const ownerTab = await app.request('/settings?tab=notifications', { headers: ORIGIN });
  const ownerHtml = await ownerTab.text();
  add('GET /settings?tab=notifications for the owner (not the other person\'s chats)', '/settings?tab=notifications', ownerTab.status, ownerTab.status === 200 && ownerHtml.includes('Owner chat') && !ownerHtml.includes('Mate chat'));
  for (const action of ['toggle', 'delete', 'test']) {
    const url = `/settings/targets/${ownerTarget.id}/${action}`;
    const res = await asMate.request(url, form({}));
    add(`POST /settings/targets/:id/${action} on the other person's chat (not theirs: nothing happens)`, url, res.status, res.status === 303);
  }
  const ownerStill = await prisma.notificationTarget.findUnique({ where: { id: ownerTarget.id } });
  add('...and the owner\'s chat is still there and still active', '(store)', 200, ownerStill?.active === true);
  add('a chat of another person is not a destination for a search', '(store)', 200, (await getNotificationTarget(DEFAULT_USER_ID, mateTarget.id)) === null && (await getNotificationTarget(teammate.id, ownerTarget.id)) === null);
  add('each person lists only their own active chats', '(store)', 200,
    (await listActiveNotificationTargets(DEFAULT_USER_ID)).every((t) => t.userId === DEFAULT_USER_ID) &&
    (await listActiveNotificationTargets(teammate.id)).map((t) => t.chatId).join() === 'mate-chat');

  // Switches, window, language, board columns, packs: the person's own.
  const toggled = await asMate.request('/settings/telegram-toggle', form({}));
  add('POST /settings/telegram-toggle by one person leaves the other\'s Alerts switch alone', '/settings/telegram-toggle', toggled.status,
    toggled.status === 303 && (await getUserSettings(teammate.id)).telegramEnabled === false && (await getUserSettings(DEFAULT_USER_ID)).telegramEnabled === ownerBefore.telegramEnabled);
  await asMate.request('/settings/telegram-toggle', form({}));
  const reapply = await asMate.request('/settings/reapply', form({ days: '60' }));
  add('POST /settings/reapply by one person leaves the other\'s window alone', '/settings/reapply', reapply.status,
    reapply.status === 303 && (await getUserSettings(teammate.id)).reapplyDays === 60 && (await getUserSettings(DEFAULT_USER_ID)).reapplyDays === ownerBefore.reapplyDays);
  const stage = await asMate.request('/settings/stages/add', form({ label: 'Mate only column' }));
  const mateStages = JSON.stringify((await getUserSettings(teammate.id)).pipelineStages);
  add('POST /settings/stages/add by one person leaves the other\'s board columns alone', '/settings/stages/add', stage.status,
    stage.status === 303 && mateStages.includes('Mate only column') && !JSON.stringify((await getUserSettings(DEFAULT_USER_ID)).pipelineStages).includes('Mate only column'));
  const lang = await asMate.request('/settings/locale', form({ locale: 'es' }));
  add('POST /settings/locale by one person leaves the other\'s language alone', '/settings/locale', lang.status,
    lang.status === 303 && (await getDisplaySettings(teammate.id)).locale === 'es' && (await getDisplaySettings(DEFAULT_USER_ID)).locale === ownerBefore.locale);
  const ownerFit = (await getPackSettings(DEFAULT_USER_ID)).minFit;
  const pack = await asMate.request('/settings/pack', { method: 'POST', headers: { ...ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: 'enabled=1&minFit=77&dailyLimit=2&maxAgeDays=14&coverLetter=asked&sections=title&maxBullets=1&keywords=1' });
  add('POST /settings/pack by one person leaves the other\'s pack settings alone', '/settings/pack', pack.status,
    pack.status === 303 && (await getPackSettings(teammate.id)).minFit === 77 && (await getPackSettings(DEFAULT_USER_ID)).minFit === ownerFit);
  // Alert timing is the person's; when the search runs is the install's (an administrator's to change).
  const globalBefore = JSON.stringify(await getSchedule());
  const alertsSave = await asMate.request('/settings/schedule', form({ part: 'alerts', alertMode: 'digest', alertFrom: '8', alertTo: '22', alertDays: '1', digestAt: '7' }));
  const mateSchedule = await getAlertSchedule(teammate.id);
  add('POST /settings/schedule (alerts) by a member stores their own timing only', '/settings/schedule', alertsSave.status,
    alertsSave.status === 303 && mateSchedule.alerts.mode === 'digest' && (await getAlertSchedule(DEFAULT_USER_ID)).alerts.mode !== 'digest' && JSON.stringify(await getSchedule()) === globalBefore);
  const mateSaved = await getAlertSchedule(teammate.id);
  await setPersonalSchedule(teammate.id, { ...mateSaved, alerts: { ...mateSaved.alerts, mode: 'instant' } });
  const fetchSave = await asMate.request('/settings/schedule', form({ part: 'fetch', fetchEvery: 'day', fetchFrom: '1', fetchTo: '2', fetchDays: '1' }));
  add('POST /settings/schedule (fetch) by a member is refused: when the search runs is the install\'s', '/settings/schedule', fetchSave.status,
    fetchSave.status === 303 && JSON.stringify(await getSchedule()) === globalBefore);

  // Mutes.
  const muted = await asMate.request('/companies/mutes', form({ name: 'Smoke Muted Inc', reason: 'mine' }));
  const mateMutes = await mutedKeys(teammate.id);
  add('POST /companies/mutes by one person mutes for them alone', '/companies/mutes', muted.status,
    muted.status === 303 && mateMutes.includes('smoke muted') && !(await mutedKeys(DEFAULT_USER_ID)).includes('smoke muted'));
  const rules = await loadEmployerRulesFor([DEFAULT_USER_ID, teammate.id]);
  const gates = employerGates('smoke muted', rules, [DEFAULT_USER_ID, teammate.id]);
  add('a posting one person muted still reaches the other (the tick turns it away only when everyone does)', '(store)', 200, gates.all === null && gates.away.has(teammate.id) && !gates.away.has(DEFAULT_USER_ID));
  const unmute = await app.request('/companies/mutes/delete', form({ key: 'smoke muted' }));
  add('POST /companies/mutes/delete of a mute the person does not have changes nothing', '/companies/mutes/delete', unmute.status, unmute.status === 303 && (await mutedKeys(teammate.id)).includes('smoke muted'));
  await asMate.request('/companies/mutes/delete', form({ key: 'smoke muted' }));

  // Delivery: a recording stand-in for Telegram, for the length of this block.
  const sent: { chat: string; text: string }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('https://api.telegram.org/bot')) return realFetch(input, init);
    const body = JSON.parse(String(init?.body ?? '{}')) as { chat_id?: string; text?: string };
    sent.push({ chat: body.chat_id ?? '', text: body.text ?? '' });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    await setTelegramEnabled(DEFAULT_USER_ID, true);
    await setTelegramEnabled(teammate.id, true);
    const notify = await prisma.company.create({
      data: {
        name: 'Notify Co',
        atsType: 'MANUAL',
        atsToken: 'notify-co',
        active: false,
        jobs: {
          create: ['n1', 'n2'].map((externalId, i) => ({
            externalId,
            title: i === 0 ? 'Notify One' : 'Notify Two',
            url: '',
            location: 'Remote',
            description: POSTING,
            postedAt: new Date(),
          })),
        },
      },
      include: { jobs: true },
    });
    const one = notify.jobs.find((j) => j.externalId === 'n1')!;
    const two = notify.jobs.find((j) => j.externalId === 'n2')!;
    const held = new Date();
    await prisma.userJob.createMany({
      data: [
        { userId: DEFAULT_USER_ID, jobId: one.id, status: 'NEW', fitScore: 90, alertHeldAt: held },
        { userId: teammate.id, jobId: one.id, status: 'NEW', fitScore: 80, alertHeldAt: held },
        { userId: teammate.id, jobId: two.id, status: 'NEW', fitScore: 70, alertHeldAt: held },
      ],
    });
    const delivered = await deliverHeldAlerts(new Date());
    const ownerMessages = sent.filter((m) => m.chat === 'owner-chat');
    const mateMessages = sent.filter((m) => m.chat === 'mate-chat');
    add('held alerts: one grouped message per person, each only to their own chat', '(worker)', 200,
      delivered.messages === 2 && ownerMessages.length === 1 && mateMessages.length === 1 &&
      ownerMessages[0]!.text.includes('Notify One') && !ownerMessages[0]!.text.includes('Notify Two') &&
      mateMessages[0]!.text.includes('Notify One') && mateMessages[0]!.text.includes('Notify Two'));
    add('...and each person\'s rows are marked as told, nobody else\'s', '(store)', 200,
      (await prisma.userJob.count({ where: { jobId: { in: [one.id, two.id] }, status: 'ALERTED', alertHeldAt: null } })) === 3);

    // An alert for one person never reaches the other's chat; a search with no chosen chat broadcasts to its owner's chats.
    sent.length = 0;
    const alert = { title: 'Alert Only', companyName: 'Notify Co', location: 'Remote', url: '', fitScore: 88, salaryMin: null, salaryMax: null, techMatch: [], redFlags: [], summary: '' };
    await sendAlert(teammate.id, alert, null);
    add('an alert broadcast to a person goes to that person\'s chats only', '(worker)', 200, sent.length === 1 && sent[0]!.chat === 'mate-chat');
    sent.length = 0;
    await sendAlert(teammate.id, alert, ownerTarget.id);
    add('a search naming another person\'s chat falls back to its owner\'s chats', '(worker)', 200, sent.length === 1 && sent[0]!.chat === 'mate-chat');

    // The recap and the nudge are each person\'s own, with their own run row and mark.
    sent.length = 0;
    await prisma.cronRun.create({ data: { name: 'digest', status: 'OK', startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), userId: teammate.id } });
    const sinceMate = await lastSuccessfulRunAt('digest', teammate.id);
    const sinceOwner = await lastSuccessfulRunAt('digest', DEFAULT_USER_ID);
    add('the recap\'s "since the last one" is read per person', '(store)', 200, sinceMate !== null && (sinceOwner === null || sinceOwner.getTime() !== sinceMate.getTime()));
    await runDigestJob(DEFAULT_USER_ID);
    await runDigestJob(teammate.id);
    const ownerDigest = sent.filter((m) => m.chat === 'owner-chat').map((m) => m.text).join('\n');
    const mateDigest = sent.filter((m) => m.chat === 'mate-chat').map((m) => m.text).join('\n');
    add('the recap of each person lists only their postings, in their own chat', '(worker)', 200,
      ownerDigest.includes('Notify One') && !ownerDigest.includes('Notify Two') && mateDigest.includes('Notify Two') && sent.every((m) => m.chat === 'owner-chat' || m.chat === 'mate-chat'));

    // Operator notices go to administrators: the member's chat hears nothing.
    sent.length = 0;
    await sendBudgetAlert('Budget notice');
    add('an operator notice reaches the administrators\' chats and not a member\'s', '(worker)', 200, sent.some((m) => m.chat === 'owner-chat') && !sent.some((m) => m.chat === 'mate-chat'));
  } finally {
    globalThis.fetch = realFetch;
    await prisma.company.deleteMany({ where: { atsToken: 'notify-co' } });
    await prisma.notificationTarget.deleteMany({ where: { id: { in: [ownerTarget.id, mateTarget.id] } } });
    await prisma.cronRun.deleteMany({ where: { name: 'digest' } });
    await setTelegramEnabled(DEFAULT_USER_ID, ownerBefore.telegramEnabled);
    await setPersonalSchedule(DEFAULT_USER_ID, ownerSchedule);
  }
  return out;
}

/**
 * Resumes and what hangs off them (ADR 0068), for the second person made by
 * isolationChecks: their own resume, fact and pack; every id of the owner's is
 * "not found", and neither person reads the other's comparison, letter or pack.
 */
async function resumeIsolationChecks(ownResumeId: number): Promise<Check[]> {
  const out: Check[] = [];
  const add = (route: string, url: string, status: number, ok: boolean): void => {
    out.push({ route, url, status, ok });
  };
  const teammate = await prisma.user.findUniqueOrThrow({ where: { oidcSub: 'smoke-teammate' } });
  const shared = await prisma.job.findFirstOrThrow({ where: { externalId: 'shared', company: { atsToken: 'isolation-co' } } });
  const mate = await createResume(teammate.id, {
    name: 'Teammate resume',
    sourceFilename: 'mate.txt',
    mimeType: 'text/plain',
    original: Buffer.from(RESUME),
    text: RESUME,
  });
  const ownerMatch = await prisma.resumeMatch.create({
    data: { jobId: shared.id, resumeId: ownResumeId, model: 'smoke', matchScore: 77, summary: 'OWNER-ONLY-COMPARISON', keywords: [], actions: [] },
  });
  const ownerLetter = await prisma.coverLetter.create({
    data: { jobId: shared.id, resumeId: ownResumeId, text: 'OWNER-ONLY-LETTER', model: 'smoke', promptVersion: 1, gateVerdict: 'pass' },
  });
  await prisma.candidateFact.create({ data: { userId: DEFAULT_USER_ID, term: 'isolationterm', status: 'confirmed' } });
  const person = (user: { id: number; name: string }, sub: string) => {
    const a = new Hono();
    a.use('*', async (c, next) => {
      c.set('session', { sub, name: user.name, uid: user.id, exp: 9_999_999_999 });
      return next();
    });
    a.use('*', withCurrentUser(loadUser));
    a.use('/jobs/*', requireHeldJob());
    a.route('/', jobsRoute);
    a.route('/', resumesRoute);
    a.route('/', factsRoute);
    a.route('/', packRoute);
    return a;
  };
  const asMate = person(teammate, 'smoke-teammate');

  const list = await asMate.request('/resumes', { headers: ORIGIN });
  const listHtml = await list.text();
  add('GET /resumes for a second person (their resumes only)', '/resumes', list.status, list.status === 200 && listHtml.includes('Teammate resume') && !listHtml.includes('Smoke resume'));
  const ownerList = await app.request('/resumes', { headers: ORIGIN });
  add('GET /resumes for the owner (not the other person\'s resume)', '/resumes', ownerList.status, ownerList.status === 200 && !(await ownerList.text()).includes('Teammate resume'));
  for (const [what, method, path] of [
    ['detail', 'GET', ''],
    ['download', 'GET', '/download'],
  ] as const) {
    const url = `/resumes/${ownResumeId}${path}`;
    const res = await asMate.request(url, { method, headers: ORIGIN });
    add(`${method} /resumes/:id${path} of the other person's resume (${what}: not found)`, url, res.status, res.status === 404);
  }
  for (const action of ['rename', 'default', 'answers', 'rescan', 'review', 'profile']) {
    const url = `/resumes/${ownResumeId}/${action}`;
    const res = await asMate.request(url, form({ name: 'Hijacked', question: 'q', answer: 'a' }));
    add(`POST /resumes/:id/${action} on the other person's resume (not found)`, url, res.status, res.status === 404);
  }
  const deleted = await asMate.request(`/resumes/${ownResumeId}/delete`, form({}));
  const stillThere = await prisma.resume.findUnique({ where: { id: ownResumeId }, select: { name: true } });
  add('POST /resumes/:id/delete on the other person\'s resume (nothing is deleted)', `/resumes/${ownResumeId}/delete`, deleted.status, deleted.status === 303 && stillThere?.name === 'Smoke resume');
  add('A search of the other person cannot link a resume they do not own', '(store)', 200, (await getResume(teammate.id, ownResumeId)) === null && (await listProfilesForResume(teammate.id, ownResumeId)).length === 0);

  // Comparisons and letters are read through the resume.
  const ownerPage = await app.request(`/jobs/${shared.id}?match=${ownerMatch.id}`, { headers: ORIGIN });
  const matePage = await asMate.request(`/jobs/${shared.id}?match=${ownerMatch.id}`, { headers: ORIGIN });
  const matePageText = await matePage.text();
  add('GET /jobs/:id shows the owner\'s comparison to the owner only', `/jobs/${shared.id}`, matePage.status, matePage.status === 200 && !matePageText.includes('OWNER-ONLY-COMPARISON') && (await ownerPage.text()).includes('OWNER-ONLY-COMPARISON'));
  const mateLetter = await asMate.request(`/jobs/${shared.id}?letter=${ownerLetter.id}`, { headers: ORIGIN });
  add('GET /jobs/:id?letter= of the owner\'s letter (not shown to the other person)', `/jobs/${shared.id}?letter=`, mateLetter.status, !(await mateLetter.text()).includes('OWNER-ONLY-LETTER'));
  const letterEdit = await asMate.request(`/jobs/${shared.id}/cover/${ownerLetter.id}`, form({ text: 'x' }));
  add('POST letter edit of the owner\'s letter (not found, unchanged)', `/jobs/${shared.id}/cover/${ownerLetter.id}`, letterEdit.status, letterEdit.status === 404 && (await prisma.coverLetter.findUniqueOrThrow({ where: { id: ownerLetter.id } })).editedText === null);

  // Facts: one term, two people, two answers.
  const mateFact = await asMate.request('/facts', form({ term: 'isolationterm', decision: 'denied' }));
  const facts = await prisma.candidateFact.findMany({ where: { term: 'isolationterm' }, orderBy: { userId: 'asc' } });
  add(
    'POST /facts by one person leaves the other person\'s answer alone',
    '/facts',
    mateFact.status,
    mateFact.status === 303 && facts.length === 2 && facts[0]?.status === 'confirmed' && facts[1]?.status === 'denied' && (await listFacts(teammate.id)).length === 1,
  );
  const crossFact = await asMate.request('/facts', form({ term: 'isolationterm', decision: 'confirmed', matchId: String(ownerMatch.id) }));
  const untouched = await prisma.resumeMatch.findUniqueOrThrow({ where: { id: ownerMatch.id } });
  add('POST /facts with the owner\'s comparison id (the comparison is not touched)', '/facts', crossFact.status, untouched.matchScore === 77);

  // Packs: one row per person and posting, and a person reaches only their own.
  const queued = await asMate.request(`/jobs/${shared.id}/pack`, form({}));
  const packs = await prisma.applicationPack.findMany({ where: { jobId: shared.id } });
  add('POST /jobs/:id/pack queues the pack for the person who asked', `/jobs/${shared.id}/pack`, queued.status, queued.status === 303 && packs.length === 1 && packs[0]?.userId === teammate.id);
  const mateState = await asMate.request(`/jobs/${shared.id}/pack/state`, { headers: ORIGIN });
  const ownerState = await app.request(`/jobs/${shared.id}/pack/state`, { headers: ORIGIN });
  add('GET /jobs/:id/pack/state (a pack is its owner\'s: the other person sees none)', `/jobs/${shared.id}/pack/state`, ownerState.status, mateState.status === 200 && ownerState.status === 404);
  const inputs = await loadPackInputs(teammate.id, shared.id, null);
  add('The worker prepares a pack with its owner\'s resume', '(store)', 200, inputs?.resume?.id === mate.id && inputs.resume.userId === teammate.id);
  const ownerInputs = await loadPackInputs(DEFAULT_USER_ID, shared.id, null);
  add('...and the owner\'s pack with the owner\'s', '(store)', 200, ownerInputs?.resume?.userId === DEFAULT_USER_ID);

  // A person who goes takes their resumes with them.
  const leaver = await prisma.user.create({ data: { name: 'Smoke leaver', role: 'MEMBER' } });
  const gone = await createResume(leaver.id, { name: 'Leaver resume', sourceFilename: 'l.txt', mimeType: 'text/plain', original: Buffer.from(RESUME), text: RESUME });
  await upsertFact(leaver.id, 'leaverterm', 'confirmed', null);
  await prisma.user.delete({ where: { id: leaver.id } });
  add(
    'Deleting a user deletes their resumes and facts',
    '(store)',
    200,
    (await prisma.resume.findUnique({ where: { id: gone.id } })) === null && (await prisma.candidateFact.count({ where: { userId: leaver.id } })) === 0,
  );
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * #413: an engine whose last calls all failed says so on AI usage and on its
 * card, whatever the probe finds installed. Three calls that found no server
 * are written for the engine this run asks first; both pages are then read.
 */
async function engineTroubleChecks(): Promise<Check[]> {
  const at = new Date();
  for (let i = 0; i < 3; i++) {
    await recordAiCall({ at, durationMs: 1, feature: 'classifier', viaFallback: false, engine: 'claude_code', model: '', outcome: 'unreachable', billing: 'plan', spend: null });
  }
  const usage = await app.request('/ai', { headers: ORIGIN });
  const tab = await app.request('/settings?tab=ai', { headers: ORIGIN });
  const usageHtml = usage.status === 200 ? await usage.text() : '';
  const tabHtml = tab.status === 200 ? await tab.text() : '';
  return [
    { route: 'GET /ai with an engine whose last calls all failed (said first, no all-clear)', url: '/ai', status: usage.status, ok: usageHtml.includes('found no server answering') && !usageHtml.includes('Nothing was billed') },
    { route: 'GET /settings?tab=ai with that engine (its card says calls failing)', url: '/settings?tab=ai', status: tab.status, ok: tabHtml.includes('calls failing') && tabHtml.includes('found no server answering') },
  ];
}

/**
 * #387: Cancel takes a pack out while it waits in the queue. The row is put
 * back afterwards, queued, as the checks after this one found it.
 */
async function packCancelCheck(jobId: number): Promise<Check> {
  const url = `/jobs/${jobId}/pack/cancel`;
  const res = await app.request(url, form({}));
  // Under `npm start` the worker may have taken the pack first: then it is no longer queued, which is all Cancel promises.
  const left = await prisma.applicationPack.findUnique({ where: { userId_jobId: { userId: DEFAULT_USER_ID, jobId } }, select: { status: true } });
  if (!left) await prisma.applicationPack.create({ data: { userId: DEFAULT_USER_ID, jobId, trigger: 'manual' } });
  return { route: 'POST /jobs/:id/pack/cancel (a pack in the queue is taken out)', url, status: res.status, ok: res.status === 303 && left?.status !== 'queued' };
}

/**
 * #382: "Prepare again" pressed on a pack the tick queued. The new preparing
 * is the person's: it takes no slot of the day's limit, and once it has
 * finished no message is owed for it. The pack is left queued, as it was.
 */
async function packAgainCheck(jobId: number): Promise<Check> {
  const url = `/jobs/${jobId}/pack`;
  const yesterday = new Date(Date.now() - DAY_MS);
  // As the worker leaves a pack it queued on its own: finished, and carried by a message.
  await prisma.applicationPack.update({ where: { userId_jobId: { userId: DEFAULT_USER_ID, jobId } }, data: { trigger: 'auto', status: 'stopped', queuedAt: yesterday, finishedAt: yesterday, notifiedAt: yesterday } });
  const res = await app.request(url, form({}));
  // Only the trigger is asked: under `npm start` the worker may have taken the pack already.
  const again = await prisma.applicationPack.findUnique({ where: { userId_jobId: { userId: DEFAULT_USER_ID, jobId } }, select: { trigger: true } });
  const counted = await autoPacksToday(DEFAULT_USER_ID, new Date());
  await prisma.applicationPack.update({ where: { userId_jobId: { userId: DEFAULT_USER_ID, jobId } }, data: { status: 'stopped' } });
  const owed = (await listUnnotifiedPacks(DEFAULT_USER_ID)).length;
  await prisma.applicationPack.update({ where: { userId_jobId: { userId: DEFAULT_USER_ID, jobId } }, data: { status: 'queued' } });
  return {
    route: "POST /jobs/:id/pack on a pack the tick queued (the person's now: no slot of today's limit, no message)",
    url,
    status: res.status,
    ok: res.status === 303 && again?.trigger === 'manual' && counted === 0 && owed === 0,
  };
}

/**
 * ADR 0062: a file of rows through its preview and its import, with fetching
 * paused so no engine is asked. While a fetch holds the lock the first press
 * stores nothing and keeps the rows; the second stores them unscored under an
 * inactive IMPORT source; the same file again adds nothing; deleting the
 * source takes its jobs.
 */
async function importChecks(): Promise<Check[]> {
  const out: Check[] = [];
  const check = (route: string, url: string, res: Response, ok: boolean): void => {
    out.push({ route, url, status: res.status, ok });
  };
  const wasFetching = (await getSettings()).fetchingEnabled;
  await setFetchingEnabled(false);
  // A migrated database with nothing seeded has no search, and an import with none running stores nothing.
  if ((await listAllActiveProfiles()).length === 0) {
    await prisma.profile.create({ data: { ...blankProfileInput(), name: 'Smoke search', active: true } });
  }
  const upload = (): Promise<Response> => {
    const body = new FormData();
    body.set('sourceName', 'Smoke export');
    body.set('file', new File([IMPORT_CSV], 'smoke.csv', { type: 'text/csv' }));
    return Promise.resolve(app.request('/jobs/import', { method: 'POST', headers: ORIGIN, body }));
  };
  const imported = (): Promise<number> => prisma.job.count({ where: { company: { atsType: 'IMPORT' } } });
  const pressImport = async (preview: string): Promise<{ res: Response; run: ReturnType<typeof getRun> }> => {
    const res = await app.request(preview, form(IMPORT_MAPPING));
    return { res, run: await settled(() => getRun((res.headers.get('location') ?? '').split('/').pop() ?? '')) };
  };

  const first = await upload();
  const preview = first.headers.get('location') ?? '';
  check('POST /jobs/import (a .csv upload)', '/jobs/import', first, first.status === 303 && /^\/jobs\/import\/[0-9a-f-]{36}$/.test(preview));
  const page = await app.request(preview, { headers: ORIGIN });
  const html = page.status === 200 ? await page.text() : '';
  check(
    'GET /jobs/import/:token (the mapping, three rows, the counts; no column about a person)',
    preview,
    page,
    html.includes('Which column is which') && html.includes('3 of them jobs') && !html.includes('Recruiter email') && !html.includes('someone@rows.example'),
  );
  // A hand-made POST naming the column the page never offers: refused, and nothing is written.
  const crafted = await app.request(preview, form({ ...IMPORT_MAPPING, employer: 'Recruiter email' }));
  check(
    'POST /jobs/import/:token mapping a column about a person (refused)',
    preview,
    crafted,
    crafted.status === 303 && crafted.headers.get('location') === preview && (await prisma.company.count({ where: { atsType: 'IMPORT' } })) === 0,
  );
  // Import pressed with a select changed since the preview: back to the preview with the new columns kept,
  // and nothing written — the rows are stored only as three of them were shown (#404).
  const unseen = await app.request(preview, form({ ...IMPORT_MAPPING, description: 'Where' }));
  const redrawn = unseen.status === 303 ? await (await app.request(preview, { headers: ORIGIN })).text() : '';
  const descriptionSelect = /<select[^>]*name="description"[\s\S]*?<\/select>/.exec(redrawn)?.[0] ?? '';
  check(
    'POST /jobs/import/:token with a column changed since the preview (shown first, nothing written)',
    preview,
    unseen,
    unseen.status === 303 &&
      unseen.headers.get('location') === preview &&
      (unseen.headers.get('set-cookie') ?? '').includes('flash=') &&
      /<option[^>]*value="Where"[^>]*selected/.test(descriptionSelect) &&
      (await prisma.company.count({ where: { atsType: 'IMPORT' } })) === 0,
  );
  const mapped = await app.request(`${preview}/mapping`, form(IMPORT_MAPPING));
  check('POST /jobs/import/:token/mapping', `${preview}/mapping`, mapped, mapped.status === 303 && mapped.headers.get('location') === preview);
  const foreign = await app.request(preview, {
    method: 'POST',
    headers: { origin: 'http://evil.example', host: 'localhost', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(IMPORT_MAPPING).toString(),
  });
  check('POST /jobs/import/:token from another origin (refused)', preview, foreign, foreign.status === 403);

  const held = await tryFetchLock();
  if (!held) throw new Error('route smoke: the fetch lock is already taken');
  try {
    const { res, run } = await pressImport(preview);
    check(
      'POST /jobs/import/:token while a fetch holds the lock (nothing stored, the rows kept)',
      preview,
      res,
      res.status === 303 && run?.stage === 'done' && run.flashKind === 'warn' && run.resultUrl === preview && (await imported()) === 0,
    );
  } finally {
    await held.release();
  }

  const { res: stored, run } = await pressImport(preview);
  const source = await prisma.company.findFirst({ where: { atsType: 'IMPORT' }, include: { jobs: { select: { employer: true, userJobs: { select: { fitScore: true } } } } } });
  check(
    'POST /jobs/import/:token while paused (stored unscored under an inactive source)',
    preview,
    stored,
    stored.status === 303 &&
      run?.stage === 'done' &&
      run.resultUrl === '/jobs' &&
      source?.active === false &&
      source.sourceConfig !== null &&
      source.jobs.length === 3 &&
      source.jobs.every((j) => j.userJobs.length > 0 && j.userJobs.every((u) => u.fitScore === null) && j.employer !== null),
  );

  // The same file again holds nothing new: its preview offers no Import, and the form posted anyway is refused
  // for that reason before anything is written (#364) — back to the preview, with the sentence.
  const again = await upload();
  const againPreview = again.headers.get('location') ?? '';
  const second = await pressImport(againPreview);
  check(
    'POST /jobs/import/:token with the same file again (refused: nothing new, no run, nothing written)',
    '/jobs/import',
    second.res,
    second.res.status === 303 && second.res.headers.get('location') === againPreview && (second.res.headers.get('set-cookie') ?? '').includes('flash=') && (await imported()) === 3,
  );
  const list = await app.request('/jobs/import', { headers: ORIGIN });
  check('GET /jobs/import with a source imported', '/jobs/import', list, list.status === 200 && (await list.text()).includes('Smoke export'));
  const removed = await app.request(`/jobs/import/sources/${source?.id ?? 0}/delete`, form({}));
  check('POST /jobs/import/sources/:id/delete (the source and its jobs)', '/jobs/import/sources/:id/delete', removed, removed.status === 303 && (await imported()) === 0);

  await setFetchingEnabled(wasFetching);
  return out;
}

/**
 * ADR 0062: a folder a tool writes into, from Check to the ledger. The folder
 * is this run's own, under the one root route-smoke-env.ts names; fetching is
 * paused, so no engine is asked. Check stores nothing; Add stores the row
 * switched off; the first check reads the file and stores its rows; the
 * second reads nothing; a path outside the root is refused.
 */
async function folderChecks(): Promise<Check[]> {
  const out: Check[] = [];
  const check = (route: string, url: string, res: Response, ok: boolean): void => {
    out.push({ route, url, status: res.status, ok });
  };
  const inbox = SMOKE_INBOX;
  const file = path.join(inbox, 'run-1.json');
  await fs.writeFile(
    file,
    JSON.stringify([
      { id: 'f1', title: 'Backend Developer', company: 'Smoke Folder Co', url: 'https://rows.example/f/1', location: 'Remote' },
      { id: 'f2', title: 'Mobile Developer', company: 'Smoke Folder Co', url: 'https://rows.example/f/2', location: 'Lisbon' },
    ]),
  );
  // Written a minute ago, as far as the look can tell: a file changed this second waits.
  const settledAt = new Date(Date.now() - 60_000);
  await fs.utimes(file, settledAt, settledAt);
  const wasFetching = (await getSettings()).fetchingEnabled;
  await setFetchingEnabled(false);
  const mapping = { title: 'title', employer: 'company', url: 'url', location: 'location', id: 'id' };
  const stored = (): Promise<number> => prisma.job.count({ where: { company: { atsType: 'FOLDER' } } });
  const checkNow = async (id: number): Promise<Response> => {
    const res = await app.request(`/companies/${id}/check-now`, form({}));
    await settled(() => getFetchRun((res.headers.get('location') ?? '').split('/').pop() ?? ''));
    return res;
  };

  try {
    const outside = await app.request('/companies/folder/check', form({ path: path.dirname(inbox) }));
    check('POST /companies/folder/check outside the named root (refused)', '/companies/folder/check', outside, outside.status === 303 && outside.headers.get('location') === '/companies');
    const preview = await app.request('/companies/folder/check', form({ path: inbox, name: 'Smoke folder' }));
    const html = preview.status === 200 ? await preview.text() : '';
    check(
      'POST /companies/folder/check (what is in it, the mapping, the next check)',
      '/companies/folder/check',
      preview,
      html.includes('1 file of rows') && html.includes('Which column is which') && html.includes('2 rows of the files it reads are jobs') && (await prisma.company.count({ where: { atsType: 'FOLDER' } })) === 0,
    );
    const added = await app.request('/companies/folder', form({ path: inbox, name: 'Smoke folder', include: '', ...mapping }));
    const folder = await prisma.company.findFirst({ where: { atsType: 'FOLDER' } });
    check('POST /companies/folder (added, switched off)', '/companies/folder', added, added.status === 303 && folder?.active === false && folder.sourceConfig !== null);
    if (!folder) return out;
    // #405: the folder's own card carries the switch, and says when its last check failed.
    await prisma.company.update({ where: { id: folder.id }, data: { lastFetchStatus: 'slug_gone', consecutiveFailures: 2 } });
    const offPage = await app.request('/companies', { headers: ORIGIN });
    const card = /<section[^>]*id="folders"[\s\S]*?<\/section>/.exec(offPage.status === 200 ? await offPage.text() : '')?.[0] ?? '';
    check(
      'GET /companies with a folder that is off and failing (its card: the switch, the failure)',
      '/companies',
      offPage,
      card.includes(`/companies/${folder.id}/toggle-active`) && card.includes('Folder not found') && card.includes('2 ticks in a row'),
    );
    await prisma.company.update({ where: { id: folder.id }, data: { lastFetchStatus: null, consecutiveFailures: 0 } });

    const off = await app.request(`/companies/${folder.id}/check-now`, form({}));
    check('POST /companies/:id/check-now on a folder that is off (refused)', `/companies/${folder.id}/check-now`, off, off.status === 303 && off.headers.get('location') === '/companies');
    await app.request(`/companies/${folder.id}/toggle-active`, form({}));
    const first = await checkNow(folder.id);
    const ledger = await prisma.sourceFile.findMany({ where: { companyId: folder.id } });
    check(
      'POST /companies/:id/check-now on a folder (the file read once, its rows stored unscored)',
      `/companies/${folder.id}/check-now`,
      first,
      first.status === 303 && (await stored()) === 2 && ledger.length === 1 && ledger[0]?.status === 'done' && ledger[0].jobCount === 2 && ledger[0].sha256 !== null,
    );
    const second = await checkNow(folder.id);
    const after = await prisma.company.findUnique({ where: { id: folder.id }, select: { lastFetchStatus: true } });
    check('POST /companies/:id/check-now again (nothing read, nothing new)', `/companies/${folder.id}/check-now`, second, second.status === 303 && (await stored()) === 2 && after?.lastFetchStatus === 'empty');
    const files = await app.request(`/companies/${folder.id}/files`, { headers: ORIGIN });
    check('GET /companies/:id/files (the per-file list)', `/companies/${folder.id}/files`, files, files.status === 200 && (await files.text()).includes('2 rows read as jobs'));
    const list = await app.request('/companies', { headers: ORIGIN });
    check('GET /companies with a folder among the sources', '/companies', list, list.status === 200 && (await list.text()).includes('1 file · 0 new at the last check'));
    // #396: "Read every file again" puts the read file back to waiting; the next check reads it from its first row and stores nothing twice.
    const reread = await app.request(`/companies/${folder.id}/files/reread`, form({}));
    const waiting = await prisma.sourceFile.findFirst({ where: { companyId: folder.id } });
    check(
      'POST /companies/:id/files/reread (the read file waits again, nothing in the folder touched)',
      `/companies/${folder.id}/files/reread`,
      reread,
      reread.status === 303 && reread.headers.get('location') === `/companies/${folder.id}/files` && waiting?.status === 'waiting' && waiting.sha256 === null && waiting.rowsRead === 0,
    );
    const third = await checkNow(folder.id);
    const again = await prisma.sourceFile.findFirst({ where: { companyId: folder.id } });
    check('POST /companies/:id/check-now after it (read again, its rows already stored)', `/companies/${folder.id}/check-now`, third, third.status === 303 && (await stored()) === 2 && again?.status === 'done' && again.rowsRead === 2);
    const removed = await app.request(`/companies/${folder.id}/delete`, form({}));
    check('POST /companies/:id/delete on a folder (its jobs and its ledger go, its files stay)', `/companies/${folder.id}/delete`, removed, removed.status === 303 && (await stored()) === 0 && (await prisma.sourceFile.count()) === 0 && (await fs.readdir(inbox)).length === 1);
    out.push(...(await savedPostingChecks(path.join(inbox, 'saved'), checkNow, stored)));
  } finally {
    await setFetchingEnabled(wasFetching);
    await fs.rm(inbox, { recursive: true, force: true });
  }
  return out;
}

/**
 * Every page once more, in the pseudo-language (ADR 0061): what went through
 * the catalog or the format module comes back in brackets, so the words left
 * outside them are English still written into the code. Since every page was
 * translated the count is a gate, not a meter (#356): one run on any page
 * fails the smoke, as a page that fails in a language other than English
 * does. Data the
 * fixtures put in (a company's name, a posting) counts until its markup says
 * `translate="no"`; that is the same work.
 */
async function pseudoPass(urls: string[]): Promise<{ rows: { route: string; url: string; status: number; ok: boolean }[]; report: string }> {
  const before = await prisma.userSettings.findUnique({ where: { userId: DEFAULT_USER_ID }, select: { locale: true } });
  await setLocale(DEFAULT_USER_ID, PSEUDO_LOCALE);
  const rows: { route: string; url: string; status: number; ok: boolean }[] = [];
  const perPage: { url: string; runs: string[] }[] = [];
  try {
    for (const url of urls) {
      const res = await app.request(url, { headers: ORIGIN });
      if (res.status >= 500) rows.push({ route: `GET ${url} in the pseudo-language`, url, status: res.status, ok: false });
      if (res.status !== 200 || !(res.headers.get('content-type') ?? '').includes('text/html')) continue;
      const runs = hardcodedText(await res.text())
        .map((run) => run.replace(NOT_INTERFACE, '').trim())
        .filter((run) => /[A-Za-z]{2,}/.test(run));
      perPage.push({ url, runs });
      // The gate (#356): a page holds no English outside the catalog. A word that is data says so in its markup
      // (`translate="no"`, or `lang="en"` for a model's words) and is not counted.
      if (runs.length > 0) {
        const shown = runs.slice(0, PSEUDO_SHOWN).map((run) => JSON.stringify(run.slice(0, PSEUDO_RUN_CHARS))).join(', ');
        rows.push({ route: `GET ${url} in the pseudo-language: ${runs.length} run(s) of English outside the catalog — ${shown}`, url, status: res.status, ok: false });
      }
    }
  } finally {
    await prisma.userSettings.upsert({ where: { userId: DEFAULT_USER_ID }, update: { locale: before?.locale ?? null }, create: { userId: DEFAULT_USER_ID, locale: before?.locale ?? null } });
  }
  const all = perPage.flatMap((p) => p.runs);
  const distinct = new Set(all);
  const listAt = process.argv.indexOf('--pseudo-list');
  const listFile = listAt >= 0 ? process.argv[listAt + 1] : undefined;
  if (listFile) writeFileSync(listFile, perPage.map((p) => `## ${p.url} (${p.runs.length})\n${p.runs.join('\n')}`).join('\n\n') + '\n');
  const top = [...perPage].sort((a, b) => b.runs.length - a.runs.length).slice(0, PSEUDO_TOP);
  const report = [
    `\npseudo-language pass: ${perPage.length} pages, ${all.length} runs of English outside the catalog (${distinct.size} distinct)`,
    ...top.map((p) => `  ${String(p.runs.length).padStart(5)}  ${p.url}`),
    listFile ? `  every run: ${listFile}` : '  (--pseudo-list <file> writes every run)',
  ].join('\n');
  rows.push({ route: `the pseudo-language pass (${perPage.length} pages drawn)`, url: '', status: 200, ok: perPage.length > 0 });
  return { rows, report };
}

const SAVED_BODY = 'Own the PHP billing services, their APIs and their queues, with two other engineers, remotely across the EU. '.repeat(3);

/**
 * ADR 0062, saved postings, with fetching paused so no engine is asked: a
 * page that states its title and company is stored unscored as a job of the
 * folder, a text file that would need a model to read them waits, and the
 * job page names the file it came from.
 */
async function savedPostingChecks(dir: string, checkNow: (id: number) => Promise<Response>, stored: () => Promise<number>): Promise<Check[]> {
  const out: Check[] = [];
  const check = (route: string, url: string, res: Response, ok: boolean): void => {
    out.push({ route, url, status: res.status, ok });
  };
  await fs.mkdir(dir, { recursive: true });
  const block = { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Senior PHP Developer', hiringOrganization: { name: 'Smoke Saved Co' }, description: SAVED_BODY };
  await fs.writeFile(path.join(dir, 'page.html'), `<html><head><link rel="canonical" href="https://saved.example/jobs/1"><script type="application/ld+json">${JSON.stringify(block)}</script></head><body><main>${SAVED_BODY}</main></body></html>`);
  await fs.writeFile(path.join(dir, 'note.txt'), `Backend Engineer\n\n${SAVED_BODY}`);
  const settledAt = new Date(Date.now() - 60_000);
  for (const name of ['page.html', 'note.txt']) await fs.utimes(path.join(dir, name), settledAt, settledAt);

  const preview = await app.request('/companies/folder/check', form({ path: dir, name: 'Smoke saved' }));
  const html = preview.status === 200 ? await preview.text() : '';
  check('POST /companies/folder/check on saved postings (read as postings, the newest without AI)', '/companies/folder/check', preview, html.includes('2 saved postings') && html.includes('Senior PHP Developer') && html.includes('https://saved.example/jobs/1'));
  const added = await app.request('/companies/folder', form({ path: dir, name: 'Smoke saved', include: '', holds: 'postings', alerts: 'off' }));
  const folder = await prisma.company.findFirst({ where: { atsType: 'FOLDER', name: 'Smoke saved' } });
  check('POST /companies/folder (saved postings added, no mapping)', '/companies/folder', added, added.status === 303 && folder?.active === false);
  if (!folder) return out;
  await app.request(`/companies/${folder.id}/toggle-active`, form({}));
  const looked = await checkNow(folder.id);
  const job = await prisma.job.findFirst({ where: { companyId: folder.id }, include: { userJobs: true } });
  const note = await prisma.sourceFile.findFirst({ where: { companyId: folder.id, relPath: 'note.txt' } });
  check(
    'POST /companies/:id/check-now on saved postings while paused (the page stored unscored, the text waits for a model)',
    `/companies/${folder.id}/check-now`,
    looked,
    (await stored()) === 1 && job?.sourceFile === 'page.html' && job.userJobs.every((u) => u.fitScore === null) && job.employer === 'Smoke Saved Co' && job.url === 'https://saved.example/jobs/1' && note?.status === 'waiting',
  );
  if (job) {
    const page = await app.request(`/jobs/${job.id}`, { headers: ORIGIN });
    check('GET /jobs/:id for a saved posting (names its folder and file)', `/jobs/${job.id}`, page, page.status === 200 && (await page.text()).includes('page.html'));
  }
  const removed = await app.request(`/companies/${folder.id}/delete`, form({}));
  check('POST /companies/:id/delete on saved postings (its job goes, its files stay)', `/companies/${folder.id}/delete`, removed, removed.status === 303 && (await stored()) === 0 && (await fs.readdir(dir)).length === 2);
  return out;
}

/** A run once it has finished, or null if it never does within the wait. */
async function settled<T extends { stage: string } | null>(read: () => T, waitMs = 10_000): Promise<T | null> {
  const until = Date.now() + waitMs;
  for (;;) {
    const run = read();
    if (run && (run.stage === 'done' || run.stage === 'error')) return run;
    if (Date.now() > until) return null;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Roles and isolation across the whole dashboard (ADR 0070). The real app, signed in as a
 * person: a session in front of it, as the sign-in would set. Every registered route is held
 * to one list or the other (admin-policy.ts); a member is then sent to each of them.
 */
function asUser(user: { id: number; name: string }): Hono {
  const w = new Hono();
  w.use('*', async (c, next) => {
    c.set('session', { sub: `smoke-user-${user.id}`, name: user.name, uid: user.id, exp: 9_999_999_999 });
    return next();
  });
  w.route('/', app);
  return w;
}

/** A pattern with every parameter filled: the fixtures where they name one, otherwise a stand-in. */
function concrete(pattern: string, f: Fixtures, ids: Record<string, string> = {}): string {
  const given = Object.entries(ids).find(([prefix]) => pattern.startsWith(prefix));
  const filled = given ? pattern.replace(':id', given[1]) : fill(pattern, f);
  return filled.replace(/:[A-Za-z]+/g, '1');
}

/** What the install runs on: a member's requests must leave all of it as it was. */
async function installFingerprint(): Promise<string> {
  const [settings, companies, users, screenings] = await Promise.all([
    prisma.appSettings.findFirst({
      select: {
        fetchingEnabled: true,
        disabledSources: true,
        hnParserEnabled: true,
        discoveryEnabled: true,
        sourceKeys: true,
        classifierMode: true,
        aiEngine: true,
        aiKeys: true,
        openAiBaseUrl: true,
        localAiUrl: true,
        aiBudgetCents: true,
        updateCheck: true,
        employerMode: true,
        screeningRetentionDays: true,
        sourceHealthAlerts: true,
        schedule: true,
        setupCompletedAt: true,
      },
    }),
    prisma.company.findMany({ select: { id: true, name: true, active: true, watched: true }, orderBy: { id: 'asc' } }),
    prisma.user.findMany({ select: { id: true, role: true }, orderBy: { id: 'asc' } }),
    prisma.screening.count(),
  ]);
  return JSON.stringify({ settings, companies, users, screenings });
}

/** What the owner holds: a member's requests with the owner's ids must leave all of it as it was. */
async function ownerFingerprint(): Promise<string> {
  const own = { userId: DEFAULT_USER_ID };
  const [resumes, jobs, profiles, targets, mutes, facts, packs, settings] = await Promise.all([
    prisma.resume.findMany({ where: own, select: { id: true, name: true, isDefault: true, version: true }, orderBy: { id: 'asc' } }),
    prisma.userJob.findMany({ where: own, select: { id: true, status: true, pipelineStage: true, applicationNotes: true }, orderBy: { id: 'asc' } }),
    prisma.profile.findMany({ where: own, select: { id: true, name: true, active: true, resumeId: true }, orderBy: { id: 'asc' } }),
    prisma.notificationTarget.findMany({ where: own, select: { id: true, active: true }, orderBy: { id: 'asc' } }),
    prisma.companyMute.count({ where: own }),
    prisma.candidateFact.count({ where: own }),
    prisma.applicationPack.count({ where: own }),
    prisma.userSettings.findUnique({ where: { userId: DEFAULT_USER_ID } }),
  ]);
  const { updatedAt: _stamp, ...kept } = settings ?? { updatedAt: null };
  return JSON.stringify({ resumes, jobs, profiles, targets, mutes, facts, packs, settings: kept });
}

/** Words that only the owner's rows carry. */
const OWNER_WORDS = ['Smoke resume', 'Smoke upload', 'Smoke Co', 'Smoke Two', 'Backend Engineer', 'Platform Engineer', 'Smoke Stats'];

/** Fields a hostile form could send to any route: none of them may change the owner's data. */
function hostileForm(f: Fixtures, ownerProfileId: number): RequestInit {
  return form({
    status: 'DISMISSED',
    name: 'Hacked',
    title: 'Hacked',
    text: 'Hacked',
    stage: 'applied',
    pipelineStage: 'applied',
    key: 'applied',
    on: '1',
    role: 'ADMIN',
    back: '/',
    resumeId: String(f.resumeId),
    jobId: String(f.jobId),
    profileId: String(ownerProfileId),
    id: String(f.resumeId),
  });
}

async function roleSweep(f: Fixtures): Promise<Check[]> {
  const out: Check[] = [];
  const add = (route: string, url: string, status: number, ok: boolean): void => {
    out.push({ route, url, status, ok });
  };
  const member = await prisma.user.create({ data: { oidcSub: 'smoke-member', name: 'Smoke member', role: 'MEMBER' } });
  await ensurePrimaryProfile(member.id);
  const asMember = asUser(member);

  // 1. Every registered route is in exactly one list (admin-policy.ts).
  const registered = [
    ...new Map(
      app.routes.filter((r) => r.method !== 'ALL' && !r.path.includes('*')).map((r) => [`${r.method} ${r.path}`, { method: r.method, path: r.path }]),
    ).values(),
  ];
  const unclassified = registered.filter((r) => classesOf(r.method, r.path).length !== 1);
  add(
    `every route is classified administrators-only or personal (${registered.length} routes)`,
    unclassified.map((r) => `${r.method} ${r.path}`).join(', ') || '(none missing)',
    unclassified.length === 0 ? 200 : 500,
    unclassified.length === 0,
  );

  // 2. A member is refused every administrators' route, and nothing the install runs on moves.
  const installBefore = await installFingerprint();
  const adminRoutes = registered.filter((r) => classesOf(r.method, r.path)[0] === 'admin');
  for (const r of adminRoutes) {
    const url = concrete(r.path, f);
    const res = await asMember.request(url, r.method === 'GET' ? { headers: ORIGIN } : form({}));
    const wizard = r.method === 'GET' && r.path === '/welcome';
    const ok = wizard ? res.status === 303 && res.headers.get('location') === '/' : res.status === 403;
    add(`member ${r.method} ${r.path} (administrators only)`, url, res.status, ok);
  }
  const forbidden = await (await asMember.request('/settings/ai/key', form({}))).text();
  add('the refusal is a page in the member\'s language, not a bare error', '/settings/ai/key', 403, forbidden.includes('Administrators only') && forbidden.includes('Smoke member') === false);
  add('administrators\' routes left the install as it was', '(database)', 200, (await installFingerprint()) === installBefore);

  // 3. The pages a member does use hold none of the owner's rows and none of the install's controls.
  const personalGets = registered.filter((r) => r.method === 'GET' && classesOf(r.method, r.path)[0] === 'personal' && !r.path.includes(':'));
  for (const r of personalGets) {
    const res = await asMember.request(r.path, { headers: ORIGIN });
    const body = res.status === 200 ? await res.text() : '';
    const leaked = OWNER_WORDS.filter((w) => body.includes(w));
    add(`member GET ${r.path} (their own page, none of the owner's rows)`, r.path, res.status, ACCEPT.has(res.status) && leaked.length === 0);
  }
  const controls: [string, string][] = [
    ['/', 'action="/runs/fetch-now"'],
    ['/', 'action="/settings/fetching-toggle"'],
    ['/settings', 'action="/settings/fetching-toggle"'],
    ['/settings?tab=general', 'action="/settings/update-check-toggle"'],
    ['/settings?tab=ai', 'action="/settings/ai/key"'],
    ['/settings?tab=sources', 'action="/settings/sources"'],
    ['/settings?tab=screening', 'action="/settings/employer-mode-toggle"'],
    ['/runs', 'action="/runs/fetch-now"'],
    ['/companies', 'action="/companies/new"'],
  ];
  for (const [url, control] of controls) {
    const res = await asMember.request(url, { headers: ORIGIN });
    const html = await res.text();
    add(`member GET ${url} draws no ${control}`, url, res.status, res.status === 200 && !html.includes(control));
  }
  const menu = await (await asMember.request('/', { headers: ORIGIN })).text();
  add(
    "the member's menu has no Discovery, AI usage, Users or Screening",
    '/',
    200,
    ['href="/discovery"', 'href="/ai"', 'href="/users"', 'href="/screen"', 'href="/welcome"'].every((h) => !menu.includes(h)) && menu.includes('href="/jobs"'),
  );
  const adminMenu = await (await app.request('/jobs', { headers: ORIGIN })).text();
  add("the administrator's menu has Discovery, AI usage and Users", '/', 200, ['href="/discovery"', 'href="/ai"', 'href="/users"'].every((h) => adminMenu.includes(h)));

  // 4. The owner's ids on every personal route that takes one: not found, and nothing of the owner's moves.
  const ownerProfile = await prisma.profile.findFirstOrThrow({ where: { userId: DEFAULT_USER_ID }, select: { id: true } });
  const ownerTarget = await addNotificationTarget(DEFAULT_USER_ID, { kind: 'TELEGRAM', name: 'Sweep chat', botToken: 'sweep-token', chatId: 'sweep-chat' });
  const ownerRun = claimRun('smoke-sweep-owner-run', { steps: ['match'], jobTitle: 'Backend Engineer', resumeName: 'Smoke resume' }).run;
  const ids = {
    '/target/runs/:id': ownerRun.id,
    '/settings/targets/:id': String(ownerTarget?.id ?? 0),
    '/settings/profiles/:id': String(ownerProfile.id),
  };
  const ownerBefore = await ownerFingerprint();
  const personalWithId = registered.filter(
    (r) =>
      classesOf(r.method, r.path)[0] === 'personal' &&
      /^\/(jobs|resumes|target\/runs|settings\/targets|settings\/profiles)\/:id/.test(r.path),
  );
  for (const r of personalWithId) {
    const url = concrete(r.path, f, ids);
    const res = await asMember.request(url, r.method === 'GET' ? { headers: ORIGIN } : hostileForm(f, ownerProfile.id));
    const body = res.status === 200 ? await res.text() : '';
    const leaked = OWNER_WORDS.filter((w) => body.includes(w));
    add(`member ${r.method} ${r.path} with the owner's id (not found)`, url, res.status, res.status !== 200 && res.status < 500 && leaked.length === 0);
  }
  add("the owner's rows are as they were after the member's requests", '(database)', 200, (await ownerFingerprint()) === ownerBefore);
  // The store refuses it too, whatever the route checked (ADR 0070).
  const refused = async (run: () => Promise<unknown>): Promise<boolean> => run().then(() => false, () => true);
  const memberProfile = await prisma.profile.findFirstOrThrow({ where: { userId: member.id }, select: { id: true } });
  add(
    "a search cannot be linked to another person's resume (the store)",
    '(store)',
    200,
    (await refused(() => createProfile(member.id, { ...blankProfileInput(), resumeId: f.resumeId }))) &&
      (await refused(() => updateProfile(member.id, memberProfile.id, { ...blankProfileInput(), resumeId: f.resumeId }))),
  );
  const ownRun = await app.request(`/target/runs/${ownerRun.id}/state`, { headers: ORIGIN });
  add('GET /target/runs/:id/state by the person who started the run (found)', `/target/runs/${ownerRun.id}/state`, ownRun.status, ownRun.status === 200);
  const otherRun = await asMember.request(`/target/runs/${ownerRun.id}/state`, { headers: ORIGIN });
  add('GET /target/runs/:id/state by someone else (gone)', `/target/runs/${ownerRun.id}/state`, otherRun.status, otherRun.status === 404);
  if (ownerTarget) await deleteNotificationTarget(DEFAULT_USER_ID, ownerTarget.id);

  out.push(...(await userPageChecks(f, member)));
  return out;
}

/** The users page (ADR 0070): roles, the rules that keep an administrator, removal with everything of the person's. */
async function userPageChecks(f: Fixtures, member: { id: number; name: string }): Promise<Check[]> {
  const out: Check[] = [];
  const add = (route: string, url: string, status: number, ok: boolean): void => {
    out.push({ route, url, status, ok });
  };
  const roleOf = async (id: number) => (await prisma.user.findUnique({ where: { id }, select: { role: true } }))?.role ?? null;

  const page = await app.request('/users', { headers: ORIGIN });
  const html = await page.text();
  add('GET /users (the administrator sees everyone)', '/users', page.status, page.status === 200 && html.includes('Smoke member') && html.includes('Default user'));

  // Nobody changes their own account here, whoever else is around.
  const self = await app.request(`/users/${DEFAULT_USER_ID}/role`, form({ role: 'MEMBER' }));
  add('POST /users/:id/role on yourself (refused)', `/users/${DEFAULT_USER_ID}/role`, self.status, self.status === 303 && flashOf(self).includes('your own account') && (await roleOf(DEFAULT_USER_ID)) === 'ADMIN');
  const selfRemove = await app.request(`/users/${DEFAULT_USER_ID}/delete`, form({}));
  add('POST /users/:id/delete on yourself (refused)', `/users/${DEFAULT_USER_ID}/delete`, selfRemove.status, selfRemove.status === 303 && (await roleOf(DEFAULT_USER_ID)) === 'ADMIN');

  const promoted = await app.request(`/users/${member.id}/role`, form({ role: 'ADMIN' }));
  add('POST /users/:id/role promotes a member', `/users/${member.id}/role`, promoted.status, promoted.status === 303 && (await roleOf(member.id)) === 'ADMIN');
  // Now an administrator, that person runs the page too: they demote the default user, who is then refused the page.
  const asNewAdmin = asUser(member);
  const demoted = await asNewAdmin.request(`/users/${DEFAULT_USER_ID}/role`, form({ role: 'MEMBER' }));
  add('POST /users/:id/role by a second administrator demotes the first', `/users/${DEFAULT_USER_ID}/role`, demoted.status, demoted.status === 303 && (await roleOf(DEFAULT_USER_ID)) === 'MEMBER');
  const lockedOut = await app.request(`/users/${member.id}/role`, form({ role: 'MEMBER' }));
  add('a demoted administrator is refused the users page', `/users/${member.id}/role`, lockedOut.status, lockedOut.status === 403 && (await roleOf(member.id)) === 'ADMIN');
  const back = await asNewAdmin.request(`/users/${DEFAULT_USER_ID}/role`, form({ role: 'ADMIN' }));
  add('POST /users/:id/role promotes the default user again', `/users/${DEFAULT_USER_ID}/role`, back.status, back.status === 303 && (await roleOf(DEFAULT_USER_ID)) === 'ADMIN');
  const noChange = await app.request(`/users/${member.id}/role`, form({ role: 'ADMIN' }));
  add('POST /users/:id/role to the role a user already has (nothing changes)', `/users/${member.id}/role`, noChange.status, noChange.status === 303 && flashOf(noChange).includes('already has that role'));
  const gone = await app.request('/users/999999/delete', form({}));
  add('POST /users/:id/delete of nobody (not found)', '/users/999999/delete', gone.status, gone.status === 303 && flashOf(gone).includes('no longer exists'));
  await prisma.user.update({ where: { id: member.id }, data: { role: 'MEMBER' } });

  // The last administrator stays, and two administrators acting at once cannot take both.
  const second = await prisma.user.create({ data: { oidcSub: 'smoke-second-admin', name: 'Second admin', role: 'MEMBER' } });
  const last = await changeUser({ actorId: second.id, targetId: DEFAULT_USER_ID, change: 'demote' });
  add('the store: the last administrator cannot be demoted', '(store)', 200, !last.ok && last.reason === 'last-admin' && (await roleOf(DEFAULT_USER_ID)) === 'ADMIN');
  const lastRemove = await changeUser({ actorId: second.id, targetId: DEFAULT_USER_ID, change: 'remove' });
  add('the store: the last administrator cannot be removed', '(store)', 200, !lastRemove.ok && lastRemove.reason === 'last-admin' && (await roleOf(DEFAULT_USER_ID)) === 'ADMIN');
  await prisma.user.update({ where: { id: second.id }, data: { role: 'ADMIN' } });
  const raced = await Promise.all([
    changeUser({ actorId: DEFAULT_USER_ID, targetId: second.id, change: 'demote' }),
    changeUser({ actorId: second.id, targetId: DEFAULT_USER_ID, change: 'demote' }),
  ]);
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  add('the store: two administrators demoting each other at once leave one', '(store)', 200, raced.filter((r) => r.ok).length === 1 && admins === 1);
  await prisma.user.update({ where: { id: DEFAULT_USER_ID }, data: { role: 'ADMIN' } });
  await prisma.user.update({ where: { id: second.id }, data: { role: 'MEMBER' } });

  // Removal takes the person and everything of theirs; the shared catalog stays.
  const leaver = await prisma.user.create({ data: { oidcSub: 'smoke-leaver', name: 'Smoke leaver', role: 'MEMBER' } });
  await ensurePrimaryProfile(leaver.id);
  const leaverResume = await createResume(leaver.id, { name: 'Leaver resume', sourceFilename: 'l.txt', mimeType: 'text/plain', original: Buffer.from(RESUME), text: RESUME });
  await prisma.userJob.create({ data: { userId: leaver.id, jobId: f.jobId, status: 'SAVED' } });
  await prisma.cronRun.create({ data: { name: 'digest', userId: leaver.id, status: 'OK' } });
  await addNotificationTarget(leaver.id, { kind: 'TELEGRAM', name: 'Leaver chat', botToken: 'leaver-token', chatId: 'leaver-chat' });
  const withData = await (await app.request('/users', { headers: ORIGIN })).text();
  add('GET /users names what removing a person would take (the confirm)', '/users', 200, withData.includes('Remove Smoke leaver?') && withData.includes('1 resume'));
  const removed = await app.request(`/users/${leaver.id}/delete`, form({}));
  const left = await Promise.all([
    prisma.user.count({ where: { id: leaver.id } }),
    prisma.resume.count({ where: { id: leaverResume.id } }),
    prisma.userJob.count({ where: { userId: leaver.id } }),
    prisma.profile.count({ where: { userId: leaver.id } }),
    prisma.notificationTarget.count({ where: { userId: leaver.id } }),
    prisma.userSettings.count({ where: { userId: leaver.id } }),
    prisma.cronRun.count({ where: { userId: leaver.id } }),
    prisma.job.count({ where: { id: f.jobId } }),
  ]);
  add('POST /users/:id/delete removes the person and all of theirs, not the shared catalog', `/users/${leaver.id}/delete`, removed.status, removed.status === 303 && left.slice(0, 7).every((n) => n === 0) && left[7] === 1);
  const stale = await asUser(leaver).request('/', { headers: ORIGIN });
  add("a removed person's next request is a sign-in again (401)", '/', stale.status, stale.status === 401);
  return out;
}
