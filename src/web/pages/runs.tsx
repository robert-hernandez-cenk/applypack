/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import { Layout } from '../layout';
import { Badge, Card, Disclosure, Empty, Flash, PageHeader, SectionTitle, Table, Td, Tr } from '../ui';
import type { FlashMessage } from '../flash';
import { formatDate, formatDuration, formatStamp } from '../format';
import { displayZoneLabel } from '../display-zone';
import type { FetchRun } from '../fetch-runs';
import { FetchNowButton } from './fetch-run';
import { FunnelCard } from './funnel-card';
import { RunningCard } from './running-card';
import { RunOutcome, type RunRow } from './run-outcome';
import type { RunningView } from '../running-view';
import { runBadge } from './overview';
import type { FunnelView } from '../../funnel';
import type { SourceYield } from '../../jobs/funnel-store';
import { liveStatusPath, showsLiveStatus } from '../run-link';
import { t } from '../../i18n/t';

export interface RunsProps {
  runs: RunRow[];
  /** The search funnel over the last 7 and 30 days, and what each source brought. */
  funnel: { week: FunnelView; month: FunnelView; sources: SourceYield[] };
  /** The runs in flight, for the "Running now" card (ADR 0072). */
  running: RunningView[];
  /** The manual fetch in flight, if any — the button turns into a link to it. */
  fetchRun: FetchRun | null;
  flash?: FlashMessage | null;
}

/** How many runs the page shows before the rest fold away: two days of hourly ticks. */
const RECENT_RUNS = 50;

/** Without script the card cannot update itself, so the page is loaded again while a run is going. */
const RELOAD_WITHOUT_SCRIPT_S = 30;

const RUNNING_BOOT = `
import { init } from '/static/running.mjs';
init(document.getElementById('running-host'));
`;

/** The header names the zone once, so each row can say only the day and the time. */
const columns = () => [
  t('runs.column.job'),
  t('runs.column.started', { zone: displayZoneLabel() }),
  <span class="block text-right">{t('runs.duration')}</span>,
  t('runs.column.status'),
  t('runs.column.whatHappened'),
];
const WIDTHS = ['w-[15%]', 'w-[17%]', 'w-[8%]', 'w-[7%]', 'w-[53%]'];

export const RunsPage: FC<RunsProps> = ({ runs, funnel, running, fetchRun, flash }) => {
  const recent = runs.slice(0, RECENT_RUNS);
  // A fresh install has read nothing yet: the empty state below says what to do.
  const funnelShown = funnel.month.stages.some((s) => s.count > 0) || funnel.sources.length > 0;
  const earlier = runs.slice(RECENT_RUNS);
  const earlierFailed = earlier.filter((r) => r.status === 'FAILED').length;
  return (
    <Layout title={t('runs.runs')} active="runs" refreshWithoutScript={running.length > 0 ? RELOAD_WITHOUT_SCRIPT_S : undefined}>
      <PageHeader title={t('runs.runs')} meta={t('runs.lastN', { n: runs.length })} actions={<FetchNowButton run={fetchRun} />}>
        {t('runs.whatTheSearchKeptAnd')}
      </PageHeader>
      <Flash flash={flash} />

      {funnelShown && <FunnelCard {...funnel} />}
      {running.length > 0 && (
        <>
          {/* public/running.mjs swaps the card in this host every few seconds, and stops when it comes back empty. */}
          <div id="running-host">
            <RunningCard rows={running} />
          </div>
          <script type="module" dangerouslySetInnerHTML={{ __html: RUNNING_BOOT }} />
        </>
      )}
      {funnelShown && runs.length > 0 && <SectionTitle level="section">{t('runs.runHistory')}</SectionTitle>}

      {runs.length === 0 ? (
        <Empty title={t('runs.noRunsYet')}>
          {t('runs.theWorkerWritesARow')}
        </Empty>
      ) : (
        <>
          <RunsTable runs={recent} caption={t('runs.runs')} />
          {earlier.length > 0 && (
            // A failure never hides: the fold says so, and opens itself when there is one.
            <Disclosure
              variant="button"
              summary={t(earlierFailed > 0 ? 'runs.earlierWithFailed' : 'runs.earlierCount', { n: earlier.length, failed: earlierFailed })}
              open={earlierFailed > 0}
              class="mt-4"
            >
              <div class="mt-3">
                <RunsTable runs={earlier} caption={t('runs.earlierRuns')} />
              </div>
            </Disclosure>
          )}
        </>
      )}
    </Layout>
  );
};

const RunsTable: FC<{ runs: RunRow[]; caption: string }> = ({ runs, caption }) => (
  <Card flush>
    <div class="overflow-x-auto">
      {/* TASKS U7: a phone keeps the job, its status and what happened. */}
      <div class="md:min-w-[56rem]">
        <Table caption={caption} columns={columns()} widths={WIDTHS} hideBelow={['', 'sm', 'md', '', '']}>
          {runs.map((r) => (
            <Tr class="align-top">
              <Td class="whitespace-nowrap font-mono text-note text-ink">
                <span translate="no">{r.name}</span>
              </Td>
              <Td class="whitespace-nowrap text-ink-muted">
                <span title={formatDate(r.startedAt)}>{formatStamp(r.startedAt)}</span>
              </Td>
              <Td class="whitespace-nowrap text-right font-mono text-note tabular-nums text-ink-muted">
                {r.finishedAt ? formatDuration(r.finishedAt.getTime() - r.startedAt.getTime()) : '—'}
              </Td>
              <Td>
                <Badge tone={runBadge(r).tone}>{runBadge(r).label}</Badge>
              </Td>
              <Td>
                {showsLiveStatus(r.status) ? (
                  <a href={liveStatusPath(r.id)} class="text-note underline">
                    {t('runs.liveStatus')}
                  </a>
                ) : (
                  <RunOutcome run={r} />
                )}
              </Td>
            </Tr>
          ))}
        </Table>
      </div>
    </div>
  </Card>
);
