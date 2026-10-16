/** @jsxImportSource hono/jsx */
import { Hono } from 'hono';
import { getAiRuntime } from '../../ai-runtime';
import { laneOf, type Lane } from '../lane';
import { TargetRunPage, type RunLanes } from '../pages/target-run';
import { flashRedirect } from '../flash';
import { getOwnRun } from '../target-runs';
import { t } from '../../i18n/t';

/*
 * The progress page every comparison, letter and verification run lands on.
 * The launcher that used to live at `/target` is gone (#55): a comparison
 * starts from the job's Resume match tab.
 */

export const targetRoute = new Hono();

/** Polled by the progress page; terminal states reload into the redirect below. */
targetRoute.get('/target/runs/:id/state', (c) => {
  const run = getOwnRun(c.req.param('id'));
  if (!run) return c.json({ gone: true }, 404);
  return c.json({
    stage: run.stage,
    steps: run.steps,
    jobTitle: run.jobTitle,
    progress: run.progress ?? null,
    results: run.results ?? {},
    resultUrl: run.resultUrl ?? null,
    error: run.error ?? null,
    stepMs: run.stepMs,
    stageElapsedMs: Date.now() - run.stageAt,
    elapsedMs: Date.now() - run.startedAt,
  });
});

/** The progress page: target-run.mjs polls the state route until the chain resolves. */
targetRoute.get('/target/runs/:id', async (c) => {
  const run = getOwnRun(c.req.param('id'));
  if (!run) {
    return flashRedirect('/jobs', 'err', t('target.flash.runGone'));
  }
  if (run.stage === 'done' && run.resultUrl) {
    return flashRedirect(run.resultUrl, run.flashKind ?? (run.reused ? 'warn' : 'ok'), run.flash ?? t('target.flash.done'), {
      rerun: run.reused,
      tailor: run.tailorUrl,
      download: run.downloadUrl,
    });
  }
  return c.html(<TargetRunPage run={run} lanes={await resumeLanes()} />);
});

/** Engine × model the resume calls run on — the run page states its measured band (#184). */
async function resumeLanes(): Promise<RunLanes> {
  const runtime = await getAiRuntime();
  const lane = (task: 'resume-read' | 'analysis'): Lane => {
    const id = runtime.chainFor(task)[0];
    return id ? laneOf(id, runtime.modelFor(id, 'resume')) : 'other';
  };
  return { read: lane('resume-read'), analysis: lane('analysis') };
}
