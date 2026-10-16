/** @jsxImportSource hono/jsx */
import { currentUser } from '../current-user';
import { Hono } from 'hono';
import { companyForPrompt } from '../../employer';
import { z } from 'zod';
import { prisma } from '../../db';
import { hashShortId } from '../../text-utils';
import { generateCoverLetter } from '../../resume/cover-letter';
import { matchResumeToJob } from '../../resume/match';
import { countWords, COVER_TONES, readCoverAngles, type CoverTone } from '../../resume/prompts';
import { getLatestCompanySnapshot, getResume } from '../../resume/store';
import { verifyJob } from '../../verification/verify';
import { getUserSettings, setCoverAngles } from '../../settings';
import { LetterStartPage } from '../pages/letter-start';
import { clearFlashCookie, flashRedirect, parseFlashCookie } from '../flash';
import { claimRun, LETTER_FAILED, startRun, updateRun, type RunStep } from '../target-runs';
import { listPickableJobs } from '../job-pick';
import { listResumeOptions } from '../resume-source';
import { t } from '../../i18n/t';

/*
 * The /letter launcher (F8.3): a stored job and a saved resume → one run:
 * [match] → [verify] → letter. A posting is added at /jobs/new and a resume on
 * the Resumes page first (#55). Everything slow is a visible run step, so the
 * form never hangs (TASKS §6.2).
 *
 * The default is the FAST path: match / verify are opt-in. A letter the user
 * is waiting on must not queue analyses it never reads.
 */

const LetterFormSchema = z.object({
  jobId: z.coerce.number().int(),
  resumeId: z.coerce.number().int(),
});

export const letterRoute = new Hono();

letterRoute.get('/letter', async (c) => {
  const [settings, jobs, resumes] = await Promise.all([getUserSettings(currentUser().id), listPickableJobs(), listResumeOptions()]);
  return c.html(
    <LetterStartPage
      jobs={jobs}
      resumes={resumes}
      angles={readCoverAngles(settings.coverAngles)}
      flash={parseFlashCookie(c.req.header('cookie'))}
    />,
    200,
    { 'Set-Cookie': clearFlashCookie() },
  );
});

letterRoute.post('/letter', async (c) => {
  const form = await c.req.parseBody();
  const parsed = LetterFormSchema.safeParse(form);
  if (!parsed.success) return flashRedirect('/letter', 'err', t('letter.flash.pickSourceAndResume'));
  const f = parsed.data;
  const tone: CoverTone = COVER_TONES.includes(form.tone as CoverTone)
    ? (form.tone as CoverTone)
    : 'warm';
  const runMatch = form.runMatch === '1';
  const runVerify = form.runVerify === '1';
  const angle = (v: unknown, max = 300) =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, max) : undefined;
  // Same contract as the job-page card: only a submit that carries the angle
  // fields rewrites the saved values. Without the marker they are reused, so
  // a POST that omits them can never wipe what the user typed.
  const fromForm = form.saveAngles === '1';
  const angles = fromForm
    ? {
        whyCompany: angle(form.whyCompany),
        problem: angle(form.problem),
        approach: angle(form.approach),
        notes: angle(form.notes, 500),
      }
    : readCoverAngles((await getUserSettings(currentUser().id)).coverAngles);
  if (fromForm) await setCoverAngles(currentUser().id, angles);

  const resume = await getResume(currentUser().id, f.resumeId);
  if (!resume) return flashRedirect('/letter', 'err', t('letter.flash.resumeGone'));
  const row = await prisma.job.findFirst({
    where: { id: f.jobId, userJobs: { some: { userId: currentUser().id } } },
    include: { company: { select: { name: true, atsType: true } } },
  });
  if (!row) return flashRedirect('/letter', 'err', t('letter.flash.jobGone'));
  const job = {
    id: row.id,
    title: row.title,
    companyName: companyForPrompt(row.employer, row.company),
    location: row.location,
    description: row.description,
    url: row.url,
    postedAt: row.postedAt,
  };

  const hasSnapshot = (await getLatestCompanySnapshot(job.id)) !== null;
  const steps: RunStep[] = [
    ...(runMatch ? (['match'] as const) : []),
    ...(runVerify && !hasSnapshot ? (['verify'] as const) : []),
    'letter',
  ];
  // Everything the user chose is in the key — the posting, the resume, the
  // tone and the two enrichers — so only a genuinely identical request joins.
  const { run, joined } = claimRun(
    `letter:${job.id}:${resume.id}:${tone}:${runMatch ? 'm' : ''}${runVerify ? 'v' : ''}:${hashShortId(JSON.stringify(angles))}`,
    {
      steps,
      jobTitle: job.title,
      resumeName: resume.name,
      jobId: job.id,
      backUrl: '/letter',
      backLabel: t('letter.run.back'),
    },
  );
  if (joined) return c.redirect(`/target/runs/${run.id}`, 303);

  startRun(run.id, async () => {
    const warnings: string[] = [];

    if (runMatch) {
      updateRun(run.id, { stage: 'match' });
      // The letter leads with strengths, which only the full report writes.
      const matched = await matchResumeToJob(
        { id: resume.id, userId: resume.userId, name: resume.name, version: resume.version, text: resume.text },
        { id: job.id, title: job.title, companyName: job.companyName, location: job.location, description: job.description },
        { mode: 'full', evidence: 'own' },
      );
      if (!matched) warnings.push(t('letter.run.matchFailed'));
    }

    if (steps.includes('verify')) {
      updateRun(run.id, { stage: 'verify' });
      const verified = await verifyJob({
        id: job.id,
        title: job.title,
        companyName: job.companyName,
        location: job.location,
        url: job.url,
        description: job.description,
        postedAt: job.postedAt,
      });
      if (!verified) warnings.push(t('letter.run.researchFailed'));
    }

    updateRun(run.id, { stage: 'letter' });
    const outcome = await generateCoverLetter(
      { id: resume.id, userId: resume.userId, text: resume.text, version: resume.version },
      { id: job.id, title: job.title, companyName: job.companyName, location: job.location, description: job.description },
      { tone, angles, evidence: 'own' },
    );
    if (outcome.kind === 'ok') {
      updateRun(run.id, {
        stage: 'done',
        resultUrl: `/jobs/${job.id}?letter=${outcome.row.id}#cover-letter`,
        flash: [
          t('letter.drafted', { n: countWords(outcome.row.text), verdict: outcome.row.gateVerdict }),
          ...warnings,
        ].join(' '),
      });
    } else if (outcome.kind === 'blocked') {
      updateRun(run.id, {
        stage: 'error',
        // The violations are the gate's own sentences and quote the letter; they stay as written.
        error: t('letter.run.blocked', { reasons: outcome.reasons.join('; ') }),
      });
    } else {
      updateRun(run.id, { stage: 'error', error: LETTER_FAILED });
    }
  });

  return c.redirect(`/target/runs/${run.id}`, 303);
});
