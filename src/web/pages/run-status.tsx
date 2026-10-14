/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import { Layout } from '../layout';
import { Badge, Card, PageHeader } from '../ui';
import { formatDate, formatDuration } from '../format';
import { RunningBlock } from './running-card';
import { RunOutcome, type RunRow } from './run-outcome';
import { runBadge } from './overview';
import type { RunningView } from '../running-view';
import { liveStatusPath } from '../run-link';
import { t } from '../../i18n/t';

/**
 * One run on its own page (#36). While it is RUNNING the page shows the
 * "Running now" block and public/running.mjs swaps in `GET /runs/:id/card`
 * every few seconds; an empty answer means the run is over and the page
 * loads again into the outcome below. Without script the page reloads itself.
 */

/** Without script the block cannot update itself, so the page is loaded again while the run goes (as /runs does). */
const RELOAD_WITHOUT_SCRIPT_S = 30;

const bootScript = (id: number) => `
import { init } from '/static/running.mjs';
init(document.getElementById('running-host'), { url: '${liveStatusPath(id)}/card' });
`;

/** The block and its frame: the page draws it first, and the poll swaps the same markup in. */
export const RunStatusBlock: FC<{ view: RunningView }> = ({ view }) => (
  <Card class="!p-4">
    <RunningBlock row={view} />
    {view.progress === null && (
      <p data-ui="hint" class="mt-2 text-note text-ink-faint">
        {t('runs.status.waiting')}
      </p>
    )}
  </Card>
);

export const RunStatusPage: FC<{ run: RunRow; view: RunningView | null }> = ({ run, view }) => (
  <Layout title={t('runs.status.title')} active="runs" refreshWithoutScript={view ? RELOAD_WITHOUT_SCRIPT_S : undefined}>
    <PageHeader
      title={t('runs.status.title')}
      meta={<span class="font-mono" translate="no">{run.name}</span>}
      back={{ href: '/runs', label: t('runs.status.back') }}
    />
    {view ? (
      <>
        <div id="running-host">
          <RunStatusBlock view={view} />
        </div>
        <script type="module" dangerouslySetInnerHTML={{ __html: bootScript(run.id) }} />
      </>
    ) : (
      <Card class="!p-4">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Badge tone={runBadge(run).tone}>{runBadge(run).label}</Badge>
          <span class="text-note tabular-nums text-ink-muted" title={formatDate(run.startedAt)}>
            {formatDate(run.startedAt)}
          </span>
          {run.finishedAt && (
            <span class="text-note tabular-nums text-ink-muted">{formatDuration(run.finishedAt.getTime() - run.startedAt.getTime())}</span>
          )}
        </div>
        <div class="mt-3">
          <RunOutcome run={run} />
        </div>
        <p data-ui="hint" class="mt-3 text-note text-ink-faint">
          {t('runs.status.ended')}
        </p>
      </Card>
    )}
  </Layout>
);
