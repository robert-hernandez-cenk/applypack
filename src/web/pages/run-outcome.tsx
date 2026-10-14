/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import type { CronRunStatus } from '@prisma/client';
import { formatDuration } from '../format';
import type { CronStats, SourceStat } from '../../jobs/cron-run';
import { tRich } from '../rich';
import { failedRunLine, summarizeRun, unscoredRun } from '../runs-summary';
import { t } from '../../i18n/t';

/** One row of Run history, as the history table and a run's own page (#36) read it. */
export interface RunRow {
  id: number;
  name: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: CronRunStatus;
  stats: unknown;
  errorMessage: string | null;
}

/** What happened in a run, in words: the failure line, or the stats sentence, or a dash. The same cell on /runs and on /runs/:id. */
export const RunOutcome: FC<{ run: RunRow }> = ({ run: r }) => (
  <>
    {r.errorMessage ? (
      <div>
        <p class="text-note leading-5 text-danger">{failedRunLine(r.name, r.errorMessage)}</p>
        <details class="mt-1">
          <summary class="cursor-pointer text-meta text-ink-faint transition-colors duration-150 hover:text-ink">{t('runs.details')}</summary>
          <pre class="mt-1 whitespace-pre-wrap break-words font-mono text-meta leading-5 text-ink-muted">{r.errorMessage}</pre>
        </details>
      </div>
    ) : r.stats ? (
      <>
        <StatsCell name={r.name} stats={r.stats} />
        {unscoredRun(r.status, r.stats) && (
          <p class="mt-1 text-note leading-5 text-warn">
            {tRich('runs.unscored', {}, { a: (words) => <a href="/settings?tab=ai" class="underline">{words}</a> })}
          </p>
        )}
      </>
    ) : (
      <span class="text-meta text-ink-faint">—</span>
    )}
  </>
);

/**
 * A run as a sentence (runs-summary.ts): the facts in a fixed order on one
 * line, the dot between them drawn rather than typed. What they were read
 * from folds behind "Details" on the same line — a fetch tick's per-source
 * list, slowest first so the source that took the minute leads, then the
 * stats JSON. (Two folds under every sentence measured worse than the JSON
 * they replaced: 2 152 words and 8 372 px against 1 410 and 7 741.)
 */
const StatsCell: FC<{ name: string; stats: unknown }> = ({ name, stats }) => {
  const { bySource, ...rest } = (typeof stats === 'object' && stats !== null ? stats : {}) as CronStats;
  const sources = Array.isArray(bySource) ? bySource : [];
  const facts = summarizeRun(name, rest);
  return (
    <div class="flex flex-wrap items-baseline gap-x-4">
      {facts.length > 0 && (
        <ul class="flex flex-wrap gap-x-2 text-note leading-5 tabular-nums text-ink-muted [&>li+li]:before:mr-2 [&>li+li]:before:text-ink-faint [&>li+li]:before:content-['·']">
          {facts.map((fact) => (
            <li>{fact}</li>
          ))}
        </ul>
      )}
      {/* A bare <details>, not the Disclosure primitive: a drawn chevron a hundred times over
          is 40 KB of markup on the one page that is a log. The native marker does here. */}
      <details class="contents">
        <summary class="cursor-pointer text-meta text-ink-faint transition-colors duration-150 hover:text-ink">{t('runs.details')}</summary>
        {/* min-w-0 + break-all: a space-less JSON string is one unbreakable word, and a flex
            item will not shrink under its longest word on its own. */}
        <div class="order-last min-w-0 basis-full pt-1 font-mono text-meta leading-5 text-ink-faint">
          {sources.length > 0 && (
            <ul class="mb-1">
              {[...sources]
                .sort((a: SourceStat, b: SourceStat) => b.ms - a.ms)
                .map((s: SourceStat) => (
                  <li>
                    {formatDuration(s.ms)} · <span translate="no">{s.name} · {s.status}</span>
                    {s.count > 0 ? ` · ${s.count}` : ''}
                  </li>
                ))}
            </ul>
          )}
          <code class="block whitespace-pre-wrap break-all">{JSON.stringify(rest)}</code>
        </div>
      </details>
    </div>
  );
};
