/** @jsxImportSource hono/jsx */
import { currentUser } from '../current-user';
import { Hono, type Context } from 'hono';
import { sameTextAs } from '../../resume/duplicate';
import { idParam } from '../params';
import { onceGuard } from '../once-guard';
import { logger } from '../../logger';
import type { ResumeReview } from '@prisma/client';
import { reviewResume } from '../../resume/review';
import { scanInBackground, scanResume } from '../../resume/scan';
import type { ResumeScan } from '../../resume/prompts';
import { matchResumeToJob } from '../../resume/match';
import { prisma } from '../../db';
import { postingForPrompt } from '../../employer';
import {
  createResume,
  findResumeWithText,
  deleteImpact,
  deleteResume,
  getLatestReviewForResume,
  getPreviousReview,
  getResume,
  getResumeOriginal,
  latestReviewByResume,
  listFacts,
  listLatestKeywordTables,
  listMatchesForResume,
  listTailoredForResume,
  listResumes,
  matchStatsByResume,
  renameResume,
  replaceResumeFile,
  type ResumeSummary,
  saveReviewAnswer,
  saveResumeTextVersion,
  setDefaultResume,
  replaceResumeBytes,
  deleteTailored,
  getTailoredForJob,
  getTailoredWithFile,
  promoteTailored,
  type TailoredSummary,
  upsertTailored,
} from '../../resume/store';
import { readAnswers, unansweredAsks } from '../../resume/answers';
import { describeStructure, docxStructure, type DocxStructure } from '../../resume/docx-structure';
import { patchDocx } from '../../resume/docx-patch';
import { readProps, withProps, type DocxProps } from '../../resume/docx-props';
import { DOCX_MIME } from '../../resume/docx-write';
import { cleanDocx } from '../../resume/draft-document';
import { patchSource, tailoredFileName } from '../../resume/tailored';
import { knobsFrom } from '../../resume/render/knobs';
import { resumeStyle } from '../resume-style';
import { deltaSentence, reviewDelta, type ReviewDelta, type ReviewSnapshot } from '../../resume/review-delta';
import { readReviewAdvice, readReviewGrades } from '../../resume/prompts';
import { coverage, MIN_POSTINGS } from '../../resume/coverage';
import { loadKeywordMatcher } from '../../resume/keyword-matcher';
import { readReviewPromptVersion } from '../../resume/review-score';
import { parseWarnings } from '../../resume/parse-warnings';
import { listProfilesForResume } from '../../profiles';
import { createProfileFromResume, newProfileDraft } from '../profile-from-resume';
import { ResumeDetailPage } from '../pages/resume-detail';
import { FormatComparePage } from '../pages/format-compare';
import { compareFormats, formatSides } from '../format-compare';
import { loadLineDiff } from '../../resume/line-diff';
import { ReactivePickPage, ResumesPage } from '../pages/resumes';
import { ResumeTextError } from '../../resume/docx-text';
import { markdownResume, reactiveResumeText } from '../../resume/resume-text';
import { getInstanceResume, InstanceError, listInstanceResumes } from '../../resume/reactive-resume-api';
import { reachable } from '../../resume/reactive-resume-url';
import { readInstanceKey, getConnectionView } from '../../resume/reactive-connection-store';
import { REACH_FAILURE, SAVED_INSTANCE_FAILURE } from '../reactive-failures';
import { stashPull, takePull, type PullTarget } from '../pull-stash';
import { isAdmin } from '../../users/admin-policy';
import { clearFlashCookie, flashRedirect, parseFlashCookie } from '../flash';
import { claimRun, startRun, updateRun } from '../target-runs';
import { runFailure } from '../run-failure';
import { hashShortId } from '../../text-utils';
import {
  MAX_RESUME_NAME_CHARS,
  nameFromFilename,
  readResumeUpload,
  resumeUploadLimit,
  type UploadedResumeFile,
} from '../upload';
import { t } from '../../i18n/t';

const MIN_DRAFT_CHARS = 200;
/** A resume runs to a few thousand characters; the model reads 30 k. Past this it is not a resume. */
const MAX_DRAFT_CHARS = 200_000;

export const resumesRoute = new Hono();

resumesRoute.get('/resumes', async (c) => {
  const [resumes, facts, stats, reviews, reactive] = await Promise.all([
    listResumes(currentUser().id),
    listFacts(currentUser().id),
    matchStatsByResume(currentUser().id),
    latestReviewByResume(currentUser().id),
    getConnectionView(currentUser().id),
  ]);
  return c.html(
    <ResumesPage
      resumes={resumes.map((r) => ({
        ...r,
        matches: stats.get(r.id) ?? null,
        review: reviews.get(r.id) ?? null,
      }))}
      facts={facts}
      reactiveConnected={reactive !== null}
      flash={parseFlashCookie(c.req.header('cookie'))}
    />,
    200,
    { 'Set-Cookie': clearFlashCookie() },
  );
});

resumesRoute.post('/resumes', resumeUploadLimit('/resumes'), onceGuard(() => 'resumes:upload', () => '/resumes'), async (c) => {
  const form = await c.req.parseBody();
  const upload = await readResumeUpload(form);
  if ('error' in upload) return flashRedirect('/resumes', 'err', upload.error);
  const name =
    typeof form.name === 'string' && form.name.trim().length > 0
      ? form.name.trim().slice(0, MAX_RESUME_NAME_CHARS)
      : nameFromFilename(upload.sourceFilename);
  return saveUploaded(c, upload, name);
});

/** A new resume from an upload, or the one it repeats; its scan runs behind the page. */
async function saveUploaded(c: Context, upload: UploadedResumeFile, name: string): Promise<Response> {
  // R16: the same text again is not a second resume, and not a second scan to pay for.
  const same = await findResumeWithText(currentUser().id, upload.text);
  if (same) {
    return flashRedirect(`/resumes/${same.id}`, 'warn', t('resume.flash.sameAsExisting', { name: same.name, version: same.version }));
  }
  const resume = await createResume(currentUser().id, { name, ...upload });
  return startScanRun(c, resume, {
    subtitle: t('resume.run.scanSubtitle', { name }),
    onScanned: () => t('resume.flash.uploaded', { name }),
    onFailed: t('resume.flash.uploadedScanFailed', { name }),
  });
}

/*
 * A resume pulled from the person's own Reactive Resume instance (ADR 0073,
 * 0075): list with the saved connection, pick, import — as a new resume or as
 * the next version of one the person owns. The key is read from the store for
 * each request and is in no stash, flash, log field or page.
 */

const formText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Where a pull ends: the resumes page, or the page of the resume it is for. */
const pullBack = (target: PullTarget): string => (target.kind === 'version' ? `/resumes/${target.resumeId}` : '/resumes');

/** One person's pull at a time (a slow instance holds nobody else up). */
const pullGuard = onceGuard(
  () => `resumes:reactive:${currentUser().id}`,
  (c) => (c.req.param('id') ? `/resumes/${c.req.param('id')}` : '/resumes'),
);

/** Only an administrator may aim the server at its own network; on a local install the one person is one. */
const mayReachInward = (): boolean => isAdmin(currentUser());

/** List the person's resumes on their saved instance and show the pick page for `target`. */
async function listForPull(c: Context, target: PullTarget, forResume?: { id: number; name: string }): Promise<Response> {
  const back = pullBack(target);
  const user = currentUser();
  const saved = await readInstanceKey(user.id);
  if (!saved) return flashRedirect(back, 'err', t('reactive.fail.noConnection'));
  const base = new URL(saved.base);
  const reach = await reachable(base, { privileged: mayReachInward() });
  if (!reach.ok) return flashRedirect(back, 'err', t(REACH_FAILURE[reach.code]));
  let found;
  try {
    found = await listInstanceResumes(base, saved.key);
  } catch (err) {
    if (err instanceof InstanceError) return flashRedirect(back, 'err', t(SAVED_INSTANCE_FAILURE[err.code]));
    throw err;
  }
  if (found.length === 0) return flashRedirect(back, 'warn', t('resumes.reactive.fail.none', { host: base.host }));
  const pull = stashPull({ userId: user.id, ids: found.map((r) => r.id), target });
  logger.info({ resumes: found.length, host: base.host, target: target.kind }, 'resume: listed from a Reactive Resume instance');
  return c.html(<ReactivePickPage pull={pull} host={base.host} resumes={found} forResume={forResume} />);
}

resumesRoute.post('/resumes/reactive/list', pullGuard, (c) => listForPull(c, { kind: 'new' }));

resumesRoute.post('/resumes/:id/reactive/list', pullGuard, async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const current = await getResume(currentUser().id, id);
  if (!current) return c.text(t('http.notFound'), 404);
  return listForPull(c, { kind: 'version', resumeId: id }, { id, name: current.name });
});

resumesRoute.post('/resumes/reactive/import', pullGuard, async (c) => {
  const form = await c.req.parseBody();
  const id = formText(form.id);
  const user = currentUser();
  // Taken whatever happens next: a list is used for one import.
  const pull = takePull(formText(form.pull), user.id);
  if (!pull) return flashRedirect('/resumes', 'err', t('resumes.reactive.fail.expired'));
  const back = pullBack(pull.target);
  if (!pull.ids.includes(id)) return flashRedirect(back, 'err', t('resumes.reactive.fail.pickOne'));
  try {
    // The version's resume is looked at first (it may be gone); the connection, the name and the person's standing
    // are read again: the check at list time is ten minutes old.
    const current = pull.target.kind === 'version' ? await getResume(user.id, pull.target.resumeId) : null;
    if (pull.target.kind === 'version' && !current) return flashRedirect('/resumes', 'err', t('reactive.fail.versionGone'));
    const saved = await readInstanceKey(user.id);
    if (!saved) return flashRedirect(back, 'err', t('reactive.fail.noConnection'));
    const base = new URL(saved.base);
    const reach = await reachable(base, { privileged: mayReachInward() });
    if (!reach.ok) return flashRedirect(back, 'err', t(REACH_FAILURE[reach.code]));
    const got = await getInstanceResume(base, saved.key, id);
    const read = reactiveResumeText(got.data);
    const name = (got.name || read.name || t('upload.defaultName')).slice(0, MAX_RESUME_NAME_CHARS);
    const upload = markdownResume(name, read.text);
    return current ? await saveNewVersion(c, current, upload) : await saveUploaded(c, upload, name);
  } catch (err) {
    if (err instanceof InstanceError) return flashRedirect(back, 'err', t(SAVED_INSTANCE_FAILURE[err.code]));
    if (err instanceof ResumeTextError) return flashRedirect(back, 'err', err.reason());
    throw err;
  }
});

/** The next version of a resume from an upload or a pull — one path, so both read alike. */
async function saveNewVersion(c: Context, current: ResumeSummary, upload: UploadedResumeFile): Promise<Response> {
  // R16: a new version that reads like the one in place changes nothing, and would pay for a scan of it.
  if (sameTextAs(upload.text, [current])) {
    return flashRedirect(`/resumes/${current.id}`, 'warn', t('resume.flash.sameAsCurrent', { version: current.version }));
  }
  const resume = await replaceResumeFile(currentUser().id, current.id, upload);
  return startScanRun(c, resume, {
    subtitle: t('resume.run.rescanSubtitle', { name: resume.name, version: resume.version }),
    onScanned: () => t('resume.flash.versionUploaded', { version: resume.version }),
    onFailed: t('resume.flash.versionScanFailed', { version: resume.version }),
  });
}

resumesRoute.post('/resumes/:id/replace', resumeUploadLimit('/resumes'), onceGuard((c) => `resumes:replace:${c.req.param('id')}`, (c) => `/resumes/${c.req.param('id')}`), async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const current = await getResume(currentUser().id, id);
  if (!current) return c.text(t('http.notFound'), 404);
  const upload = await readResumeUpload(await c.req.parseBody());
  if ('error' in upload) return flashRedirect(`/resumes/${id}`, 'err', upload.error);
  return saveNewVersion(c, current, upload);
});

// TASKS R14: the same resume as another file, read beside the saved one — rendered, never stored, no AI.
resumesRoute.post('/resumes/:id/compare-format', resumeUploadLimit('/resumes'), async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const resume = await getResume(currentUser().id, id);
  if (!resume) return c.text(t('http.notFound'), 404);
  const upload = await readResumeUpload(await c.req.parseBody());
  if ('error' in upload) return flashRedirect(`/resumes/${id}#ats`, 'err', upload.error);
  const [saved, uploaded] = formatSides(resume.sourceFilename, resume.version, upload.sourceFilename);
  const { diffLines } = await loadLineDiff();
  const result = compareFormats({ ...saved, text: resume.text }, { ...uploaded, text: upload.text }, diffLines);
  return c.html(<FormatComparePage resume={resume} files={[resume.sourceFilename, upload.sourceFilename]} result={result} />);
});

resumesRoute.get('/resumes/:id', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const [resume, matches, tailored, review, linkedProfiles, impact, tables, facts, reactive] = await Promise.all([
    getResume(currentUser().id, id),
    listMatchesForResume(currentUser().id, id),
    listTailoredForResume(currentUser().id, id),
    getLatestReviewForResume(currentUser().id, id),
    listProfilesForResume(currentUser().id, id),
    deleteImpact(currentUser().id, id),
    listLatestKeywordTables(currentUser().id, id),
    listFacts(currentUser().id),
    getConnectionView(currentUser().id),
  ]);
  if (!resume) return c.text(t('http.notFound'), 404);
  // What the compared postings keep asking for (N10): no AI, the stored
  // tables read against the text as it is now.
  const missing =
    tables.length < MIN_POSTINGS ? null : coverage(tables, resume.text, facts, await loadKeywordMatcher());
  // The template check is recomputed from the bytes on every view (ADR 0038) —
  // 40 KB of XML, sub-millisecond. Only a .docx is read; a 5 MB PDF is not
  // pulled out of the database to learn its extension.
  const original = isDocx(resume.sourceFilename) ? await getResumeOriginal(currentUser().id, id) : null;
  const docx = original ? Buffer.from(original.original) : null;
  const structure: DocxStructure | null = docx ? docxStructure(docx) : null;
  const props: DocxProps | null = docx ? readProps(docx) : null;
  // The run before this one, so the card can say what the edits changed.
  const previous = review ? await getPreviousReview(currentUser().id, id, review.id) : null;
  return c.html(
    <ResumeDetailPage
      resume={resume}
      matches={matches}
      tailored={tailored}
      coverage={missing}
      review={review}
      answers={readAnswers(resume.answers)}
      reviewDelta={deltaFor(review, previous)}
      deleteImpact={impact}
      warnings={parseWarnings(resume.text)}
      structure={structure}
      props={props}
      // The draft the "Create a search" button would save — rendered, not
      // stored (ADR 0015). Only a scanned resume has anything to say.
      search={{
        linkedProfiles,
        draft: resume.scannedAt ? newProfileDraft(resume) : null,
      }}
      reactiveConnected={reactive !== null}
      flash={parseFlashCookie(c.req.header('cookie'))}
    />,
    200,
    { 'Set-Cookie': clearFlashCookie() },
  );
});

resumesRoute.get('/resumes/:id/download', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const row = await getResumeOriginal(currentUser().id, id);
  if (!row) return c.text(t('http.notFound'), 404);
  const filename = row.sourceFilename.replace(/["\r\n]/g, '');
  return new Response(Buffer.from(row.original), {
    headers: {
      'Content-Type': row.mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

/* ---------- tailored copies (ADR 0077) ---------- */

resumesRoute.get('/tailored/:id/download', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const copy = await getTailoredWithFile(currentUser().id, id);
  if (!copy) return c.text(t('http.notFound'), 404);
  return new Response(Buffer.from(copy.original), {
    headers: {
      'Content-Type': copy.mimeType,
      'Content-Disposition': `attachment; filename="${copy.sourceFilename.replace(/["\r\n]/g, '')}"`,
    },
  });
});

resumesRoute.post('/tailored/:id/delete', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const gone = await deleteTailored(currentUser().id, id);
  if (!gone) return flashRedirect('/resumes', 'err', t('resume.tailored.gone'));
  return flashRedirect(`/resumes/${gone.resumeId}#tailored`, 'ok', t('resume.tailored.deleted', { job: gone.jobTitle }));
});

/** The old overwrite, on purpose: the copy becomes the resume's next version, and the new text is scanned. */
resumesRoute.post('/tailored/:id/promote', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const resume = await promoteTailored(currentUser().id, id);
  if (!resume) return flashRedirect('/resumes', 'err', t('resume.tailored.gone'));
  scanInBackground(resume);
  return flashRedirect(`/resumes/${resume.id}`, 'ok', t('resume.tailored.promoted', { name: resume.name, version: resume.version }));
});

resumesRoute.post('/resumes/:id/draft', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const current = await getResume(currentUser().id, id);
  if (!current) return c.text(t('http.notFound'), 404);
  const form = await c.req.parseBody();
  const text = typeof form.text === 'string' ? form.text.replace(/\r\n/g, '\n').trim() : '';
  if (text.length < MIN_DRAFT_CHARS) {
    return flashRedirect(`/resumes/${id}`, 'err', t('resume.flash.draftTooShort'));
  }
  if (text.length > MAX_DRAFT_CHARS) {
    return flashRedirect(`/resumes/${id}`, 'err', t('resume.flash.draftTooLong', { max: MAX_DRAFT_CHARS }));
  }
  // What the edits are relative to — the text the editor started from. Without
  // it a .docx cannot be patched (the diff would be against nothing) and the
  // save is the clean version (ADR 0059).
  const baseText = typeof form.baseText === 'string' ? form.baseText.replace(/\r\n/g, '\n').trim() : '';
  const jobId = idParam(form.jobId);
  // A tailored copy is written for one posting (ADR 0077); the target page is
  // the only caller and always names it.
  const job = Number.isFinite(jobId)
    ? await prisma.job.findFirst({ where: { id: jobId, userJobs: { some: { userId: currentUser().id } } }, include: { company: { select: { name: true, atsType: true } } } })
    : null;
  if (!job) return flashRedirect(`/resumes/${id}`, 'err', t('resume.flash.draftNeedsJob'));

  // Claimed BEFORE the save, not after: this route's side effect is a saved
  // copy, so a second submit that got as far as saving would write it twice
  // whatever the run registry then did. Keyed on the text, because that is
  // what the user submitted (issue #76).
  const { run, joined } = claimRun(`draft:${id}:${hashShortId(text)}:${job.id}`, {
    steps: ['keywords'],
    jobTitle: job.title,
    resumeName: '',
    jobId: job.id,
    heading: { running: t('resume.run.draftRunning'), failed: t('resume.run.draftFailed') },
    subtitle: t('resume.run.saving'),
    backUrl: `/resumes/${id}`,
    backLabel: t('resume.backToResume'),
  });
  if (joined) return c.redirect(`/target/runs/${run.id}`, 303);

  // The save happens inside the run, so a failure lands on the progress page
  // as an error instead of stranding a claimed run nothing will ever finish.
  // The comparison is the slow part after it, which is why this gets a run.
  startRun(run.id, async () => {
    const { copy, note, document } = await saveTailored(current, job.id, job.title, text, baseText);
    const saved = { note };
    // TASKS R25: the saved file — the user's own .docx written into, or the clean one — handed back.
    const downloadUrl = document ? `/tailored/${copy.id}/download` : undefined;
    updateRun(run.id, { resumeName: current.name, subtitle: t('resume.save.scoring', saved) });
    let reason = '';
    const noteReason = (r: string) => {
      reason = r;
    };
    // The resume is not scanned: the copy is not the resume (ADR 0077). The
    // comparison judges the copy's words under the resume's identity.
    const match = await matchResumeToJob({ ...current, text: copy.text }, postingForPrompt(job), { tailoredId: copy.id, onError: noteReason });
    updateRun(run.id, match
      ? {
          stage: 'done',
          resultUrl: `/jobs/${job.id}/target?match=${match.id}`,
          flash: t('resume.save.checked', { ...saved, score: match.matchScore }),
          downloadUrl,
        }
      : {
          stage: 'error',
          error: runFailure(t('resume.save.compareFailed', saved), reason, t('resume.save.compareFailedNext')),
        });
  });
  return c.redirect(`/target/runs/${run.id}`, 303);
});

function isDocx(filename: string): boolean {
  return /\.docx$/i.test(filename);
}

/**
 * Save the editor's text as the tailored copy for one posting — as a document,
 * never as a Markdown file — and leave the resume alone (ADR 0077). When the
 * file is a .docx the template check allows, the user's own file is patched
 * with the edits (ADR 0038); otherwise the copy is the clean .docx the Tailor
 * page's document pane drew, in the typeface read off the resume's file
 * (ADR 0039), and `note` says why. A text copy is left only for a clean file
 * that would drop a line.
 *
 * The edits are patched into the file the editor's text came from: the
 * copy's own when it started from the copy (`patchSource`), else the resume's.
 */
async function saveTailored(
  current: ResumeSummary,
  jobId: number,
  jobTitle: string,
  text: string,
  baseText: string,
): Promise<{ copy: TailoredSummary; note: string; document: boolean }> {
  const id = current.id;
  const userId = currentUser().id;
  const [masterRow, existing] = await Promise.all([getResumeOriginal(userId, id), getTailoredForJob(userId, id, jobId)]);
  const fromCopy = existing !== null && patchSource({ baseText, copyText: existing.text }) === 'copy';
  const row = fromCopy ? await getTailoredWithFile(userId, existing.id) : masterRow;
  let file: { sourceFilename: string; mimeType: string; original: Buffer; text: string } | null = null;
  let why = row && /\.pdf$/i.test(row.sourceFilename) ? t('resume.save.why.pdf') : t('resume.save.why.text');
  if (row && isDocx(row.sourceFilename)) {
    const original = Buffer.from(row.original);
    if (!baseText) why = t('resume.save.why.noBase');
    else if (docxStructure(original).kind === 'unsupported') why = t('resume.save.why.unsupported');
    else {
      const patched = await patchDocx(original, baseText, text);
      if (patched.ok) {
        const r = patched.report;
        file = { sourceFilename: tailoredFileName(current.name, jobTitle, 'docx'), mimeType: DOCX_MIME, original: patched.docx, text: patched.text };
        why = t('resume.save.why.patched', { changed: r.changed, added: r.added, removed: r.removed });
        logger.info({ id, ...r, bytes: patched.docx.length }, 'resume: docx patched');
      } else {
        why = t('resume.save.why.refused', { reason: patched.shown });
        logger.info({ id, reason: patched.reason, skipped: patched.report?.skipped }, 'resume: docx patch refused');
      }
    }
  }
  let note = why;
  if (!file) {
    // The typeface is the resume's own, whichever file the edits came from.
    const style = masterRow ? await resumeStyle(current, masterRow) : undefined;
    const clean = await cleanDocx(text, knobsFrom(style), style?.layout ?? null);
    if (clean.missing.length === 0) {
      file = { sourceFilename: tailoredFileName(current.name, jobTitle, 'docx'), mimeType: DOCX_MIME, original: clean.docx, text: clean.text };
      note = t('resume.save.note.clean', { why });
    } else {
      note = t('resume.save.note.text', { why, n: clean.missing.length });
      logger.info({ id, missing: clean.missing.slice(0, 3) }, 'resume: clean save would drop lines');
    }
  }
  const payload = file ?? {
    sourceFilename: tailoredFileName(current.name, jobTitle, 'md'),
    mimeType: 'text/markdown',
    original: Buffer.from(text, 'utf8'),
    text,
  };
  return { copy: await upsertTailored(userId, id, jobId, payload), note, document: file !== null };
}

/**
 * "Fix document properties": the template author's name and title out, the
 * candidate's in, bytes only — the words, the version and the scan stay.
 * Offered on click with the current values shown, never done silently.
 */
resumesRoute.post('/resumes/:id/props', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const [resume, row] = await Promise.all([getResume(currentUser().id, id), getResumeOriginal(currentUser().id, id)]);
  if (!resume || !row) return c.text(t('http.notFound'), 404);
  if (!isDocx(row.sourceFilename)) return flashRedirect(`/resumes/${id}`, 'err', t('resume.flash.propsOnlyDocx'));
  const candidate = resume.text.split('\n')[0]?.trim() || resume.name;
  const fixed = await withProps(Buffer.from(row.original), { title: `${candidate} — Resume`, creator: candidate, lastModifiedBy: candidate });
  await replaceResumeBytes(currentUser().id, id, fixed);
  return flashRedirect(`/resumes/${id}`, 'ok', t('resume.flash.propsFixed', { candidate }));
});

/**
 * "Create a search from this resume" — the card above the button already
 * showed exactly what this writes, so one press is enough (ADR 0015).
 */
resumesRoute.post('/resumes/:id/profile', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const resume = await getResume(currentUser().id, id);
  if (!resume) return c.text(t('http.notFound'), 404);
  if (!resume.scannedAt) {
    return flashRedirect(`/resumes/${id}`, 'err', t('resume.flash.scanFirst'));
  }
  const profile = await createProfileFromResume(resume);
  logger.info({ profileId: profile.id, resumeId: id }, 'profile: created from resume');
  return flashRedirect(
    `/settings?tab=profile&profile=${profile.id}`,
    'ok',
    t('resume.flash.searchCreated', { search: profile.name, resume: resume.name }),
  );
});

resumesRoute.post('/resumes/:id/rescan', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const resume = await getResume(currentUser().id, id);
  if (!resume) return c.text(t('http.notFound'), 404);
  return startScanRun(c, resume, {
    subtitle: t('resume.run.scanSubtitle', { name: resume.name }),
    onScanned: (scan) => t('resume.flash.scanned', { skills: scan.skills.length, issues: scan.issues.length }),
    onFailed: t('resume.flash.scanFailed'),
  });
});

/** A stored review as the delta reads it; null passes straight through. */
function snapshotOf(review: ResumeReview | null): ReviewSnapshot | null {
  if (!review) return null;
  return {
    score: review.reviewScore,
    version: review.resumeVersion,
    promptVersion: readReviewPromptVersion(review.breakdown),
    grades: readReviewGrades(review.grades).map((g) => ({ dimension: g.dimension, grade: g.grade })),
  };
}

/** What moved between two runs of one resume — null unless both exist. */
function deltaFor(current: ResumeReview | null, previous: ResumeReview | null): ReviewDelta | null {
  const now = snapshotOf(current);
  return now ? reviewDelta(snapshotOf(previous), now) : null;
}

/**
 * "Run strength review" — one AI call, on demand only (resumes-plan §B.1). The
 * run registry shows the rubric being walked instead of a spinner; nothing
 * about the resume changes, so a failure costs the user nothing but the wait.
 */
resumesRoute.post('/resumes/:id/review', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const resume = await getResume(currentUser().id, id);
  if (!resume) return c.text(t('http.notFound'), 404);
  const { text, version, roleTypes, answers } = resume;
  const answered = readAnswers(answers);

  // Two tabs used to start two reviews of the same version and store both
  // (PR #86's follow-up); the second POST now joins the first. The answers are
  // part of the key, hashed rather than counted: correcting a figure leaves the
  // count alone but is a different review, and must not join the run that
  // predates it.
  const { run, joined } = claimRun(`review:${id}:v${version}:${hashShortId(JSON.stringify(answered))}`, {
    steps: ['review'],
    jobTitle: '',
    resumeName: resume.name,
    heading: { running: t('review.run.running'), failed: t('review.run.failed') },
    subtitle: t('review.run.subtitle'),
    backUrl: `/resumes/${id}`,
    backLabel: t('resume.backToResume'),
  });
  if (joined) return c.redirect(`/target/runs/${run.id}`, 303);
  startRun(run.id, async () => {
    const row = await reviewResume({ id, text, version, roleTypes, answers });
    const delta = deltaFor(row, row ? await getPreviousReview(currentUser().id, id, row.id) : null);
    updateRun(run.id, row
      ? {
          stage: 'done',
          resultUrl: `/resumes/${id}`,
          flash: delta
            ? deltaSentence(delta)
            : t('review.flash.done', { score: row.reviewScore, headline: row.headline }),
        }
      : { stage: 'error', error: t('review.run.error') });
  });
  return c.redirect(`/target/runs/${run.id}`, 303);
});

/**
 * One answer to one of the review's questions (ADR 0030 phase 3). No AI call
 * and no re-run: the answer is stored, and the NEXT review reads it. Saying so
 * in the flash matters — this is a button that spends nothing, and the user
 * should know which button does.
 */
resumesRoute.post('/resumes/:id/answers', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const form = await c.req.parseBody();
  const question = typeof form.question === 'string' ? form.question : '';
  const answer = typeof form.answer === 'string' ? form.answer : '';
  if (question.trim().length === 0) return c.text(t('http.badAnswer'), 400);

  const saved = await saveReviewAnswer(currentUser().id, id, question, answer);
  if (saved === null) return c.text(t('http.notFound'), 404);
  const open = unansweredAsks(
    readReviewAdvice((await getLatestReviewForResume(currentUser().id, id))?.advice).map((a) => a.ask),
    saved,
  ).length;
  const cleared = answer.trim().length === 0;
  logger.info({ resumeId: id, answers: saved.length, open, cleared }, 'resume: review answer saved');
  return flashRedirect(
    `/resumes/${id}#resume-strength`,
    'ok',
    cleared ? t('review.flash.answerRemoved') : t('review.flash.answerSaved', { open }),
  );
});

/**
 * Rename a resume (§12 quick win). The name is what every picker, flash and
 * "applied with" line says, and until now it was whatever the uploaded file
 * happened to be called — `nameFromFilename` on a download from a job board
 * produces things like "Alex Doe Senior Backend Resume (3)".
 */
resumesRoute.post('/resumes/:id/rename', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  const form = await c.req.parseBody();
  const name = (typeof form.name === 'string' ? form.name : '').trim().slice(0, MAX_RESUME_NAME_CHARS);
  if (name.length === 0) {
    return flashRedirect(`/resumes/${id}`, 'err', t('resume.flash.needsName'));
  }
  const renamed = await renameResume(currentUser().id, id, name);
  if (!renamed) return c.text(t('http.notFound'), 404);
  return flashRedirect(`/resumes/${id}`, 'ok', t('resume.flash.renamed', { name }));
});

resumesRoute.post('/resumes/:id/default', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  if (!(await getResume(currentUser().id, id))) return c.text(t('http.notFound'), 404);
  await setDefaultResume(currentUser().id, id);
  return flashRedirect(`/resumes/${id}`, 'ok', t('resume.flash.defaultUpdated'));
});

resumesRoute.post('/resumes/:id/delete', async (c) => {
  const id = idParam(c.req.param('id'));
  if (!Number.isFinite(id)) return c.text(t('http.badId'), 400);
  // A row that was not there is not a deletion. Saying it was sent a user
  // looking for a resume they still have back to a list that still shows it.
  const deleted = await deleteResume(currentUser().id, id);
  if (!deleted) {
    return flashRedirect('/resumes', 'warn', t('resume.flash.deleteMissing'));
  }
  logger.info({ id }, 'resume: deleted');
  return flashRedirect('/resumes', 'ok', t('resume.flash.deleted'));
});

/**
 * Upload, replace and rescan all end in the same ~60 s call to the resume
 * model. Awaiting it inline froze the browser on a live form: the submit
 * button stayed enabled, so a second click created a duplicate resume *and*
 * a second AI call. The run registry — already carrying /target and
 * /jobs/:id/match — returns the POST immediately and shows real progress.
 */
function startScanRun(
  c: Context,
  resume: ResumeSummary,
  copy: { subtitle: string; onScanned: (scan: ResumeScan) => string; onFailed: string },
): Response {
  const { id, name, text } = resume;
  const { run, joined } = claimRun(`scan:${id}:${hashShortId(text)}`, {
    steps: ['scan'],
    jobTitle: '',
    resumeName: name,
    heading: { running: t('resume.run.scanRunning'), failed: t('resume.run.scanFailed') },
    subtitle: copy.subtitle,
    // The row exists either way, so the error state has somewhere real to go.
    backUrl: `/resumes/${id}`,
    backLabel: t('resume.backToResume'),
  });
  if (joined) return c.redirect(`/target/runs/${run.id}`, 303);
  startRun(run.id, async () => {
    const scan = await scanResume({ id, userId: currentUser().id, text });
    updateRun(run.id, scan
      ? { stage: 'done', resultUrl: `/resumes/${id}`, flash: copy.onScanned(scan) }
      : { stage: 'error', error: copy.onFailed });
  });
  return c.redirect(`/target/runs/${run.id}`, 303);
}

/** "Alex_Doe_Senior_Backend_Resume.docx" → "Alex Doe Senior Backend Resume". */
