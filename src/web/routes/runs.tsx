/** @jsxImportSource hono/jsx */
import { CronRunStatus } from '@prisma/client';
import { currentUser } from '../current-user';
import { Hono } from 'hono';
import { prisma } from '../../db';
import { RunsPage } from '../pages/runs';
import { RunningCard } from '../pages/running-card';
import { runningView, type RunningView } from '../running-view';
import { FetchRunPage } from '../pages/fetch-run';
import { clearFlashCookie, flashRedirect, parseFlashCookie } from '../flash';
import { FETCH_RUN_STEPS, activeFetchRun, getFetchRun } from '../fetch-runs';
import { beginFetchNow } from '../fetch-now';
import { summarizeFetchRun } from '../fetch-summary';
import { folderCheckLine } from '../folder-words';
import { loadFunnel, loadSourceYield } from '../../jobs/funnel-store';
import { t } from '../../i18n/t';

const RUNS_LIMIT = 100;

export const runsRoute = new Hono();

/** The runs this person sees: the install's, and the recaps and nudges that were theirs (ADR 0069). */
const visibleRuns = () => ({ OR: [{ userId: null }, { userId: currentUser().id }] });

/** The ones in flight, laid out for the card. */
async function loadRunning(): Promise<RunningView[]> {
  const rows = await prisma.cronRun.findMany({
    where: { status: CronRunStatus.RUNNING, ...visibleRuns() },
    orderBy: { startedAt: 'asc' },
    select: { id: true, name: true, startedAt: true, progress: true },
  });
  const now = Date.now();
  return rows.map((row) => runningView(row, now));
}

runsRoute.get('/runs', async (c) => {
  const now = new Date();
  const [runs, funnel, sources, running] = await Promise.all([
    prisma.cronRun.findMany({
      where: visibleRuns(),
      orderBy: { startedAt: 'desc' },
      take: RUNS_LIMIT,
    }),
    loadFunnel(now),
    loadSourceYield(currentUser().id, now),
    loadRunning(),
  ]);
  return c.html(
    <RunsPage
      runs={runs}
      funnel={{ ...funnel, sources }}
      running={running}
      fetchRun={activeFetchRun()}
      flash={parseFlashCookie(c.req.header('cookie'))}
    />,
    200,
    { 'Set-Cookie': clearFlashCookie() },
  );
});

/** The card alone, for public/running.mjs to swap in: empty when nothing runs (the module then stops asking). */
runsRoute.get('/runs/running', async (c) => {
  const rows = await loadRunning();
  c.header('Cache-Control', 'no-store');
  return rows.length === 0 ? c.html('') : c.html(<RunningCard rows={rows} />);
});

/** "Fetch now" from the Overview or /runs — every source, due or not (fetch-now.ts). */
runsRoute.post('/runs/fetch-now', async (c) => {
  const run = await beginFetchNow({ backUrl: '/runs' });
  return c.redirect(`/runs/fetch-now/${run.id}`, 303);
});

/** Polled by the progress page; terminal states reload into the redirect below. */
runsRoute.get('/runs/fetch-now/:id/state', (c) => {
  const run = getFetchRun(c.req.param('id'));
  if (!run) return c.json({ gone: true }, 404);
  const { stage, classify, sourcesDone, sourcesTotal, jobsFetched, lastSource } = run;
  return c.json({
    stage,
    steps: FETCH_RUN_STEPS,
    classify,
    sourcesDone,
    sourcesTotal,
    jobsFetched,
    lastSource,
    stageElapsedMs: Date.now() - run.stageAt,
    elapsedMs: Date.now() - run.startedAt,
  });
});

runsRoute.get('/runs/fetch-now/:id', (c) => {
  const run = getFetchRun(c.req.param('id'));
  if (!run) {
    return flashRedirect(
      '/runs',
      'err',
      t('runs.fetchRunGone'),
    );
  }
  if (run.stage === 'done') {
    const label = typeof run.scope === 'object' ? t('runs.checked', { name: run.scope.name }) : undefined;
    // A folder that brought nothing has its own two sentences: there is no network to check.
    const own = typeof run.scope === 'object' && run.scope.folder ? folderCheckLine(t('runs.checked', { name: run.scope.name }), run.stats ?? {}) : null;
    const { kind, text } = own ?? summarizeFetchRun(run.stats ?? {}, label);
    return flashRedirect(run.backUrl, kind, text);
  }
  return c.html(<FetchRunPage run={run} />);
});
