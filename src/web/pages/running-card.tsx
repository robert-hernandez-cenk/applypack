/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import { Card, SectionTitle } from '../ui';
import { formatDuration } from '../format';
import { MESSAGE_KEYS, type MessageKey } from '../../i18n/catalog';
import { formatNumber } from '../../i18n/format';
import { t } from '../../i18n/t';
import type { RunningProgressView, RunningView } from '../running-view';

/**
 * "Running now" on /runs (ADR 0072): one block per RUNNING row. The whole
 * card is server-rendered, so it is also the body of `GET /runs/running`,
 * which `public/running.mjs` swaps in every few seconds.
 */

const KNOWN_KEYS: ReadonlySet<string> = new Set(MESSAGE_KEYS);

/** A job stores catalog keys for its stage and unit; a key this build does not know is left out, never shown raw. */
function worded(key: string): string | null {
  return KNOWN_KEYS.has(key) ? t(key as MessageKey) : null;
}

function counterLine([name, n]: [string, number]): string | null {
  const word = worded(`runs.running.counter.${name}`);
  return word === null ? null : `${formatNumber(n)} ${word}`;
}

export const RunningCard: FC<{ rows: RunningView[] }> = ({ rows }) =>
  rows.length === 0 ? null : (
    <section id="running-now" data-ui="running-now" class="mb-8">
      <SectionTitle level="section">{t('runs.running.title')}</SectionTitle>
      <div class="space-y-3">
        {rows.map((row) => (
          <Card class="!p-4">
            <RunningBlock row={row} />
          </Card>
        ))}
      </div>
    </section>
  );

const RunningBlock: FC<{ row: RunningView }> = ({ row }) => {
  const p = row.progress;
  return (
    <div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p class="text-ink">
          <span class="font-mono text-note" translate="no">{row.name}</span>
          {p && worded(p.label) && <span class="text-ink-muted"> · {worded(p.label)}</span>}
        </p>
        <p class="text-note tabular-nums text-ink-muted">{t('runs.running.elapsed', { time: formatDuration(row.elapsedMs) })}</p>
      </div>
      {p && <ProgressLines name={row.name} p={p} />}
    </div>
  );
};

const ProgressLines: FC<{ name: string; p: RunningProgressView }> = ({ name, p }) => {
  const unit = worded(p.unit);
  const counters = p.counters.map(counterLine).filter((line): line is string => line !== null);
  const percent = p.fraction === null ? null : Math.round(p.fraction * 100);
  return (
    <>
      {p.done !== null && (
        <div class="mt-2 flex items-center gap-3">
          <span
            class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-overlay"
            role="progressbar"
            aria-label={t('runs.running.barLabel', { name })}
            aria-valuemin={percent === null ? undefined : 0}
            aria-valuemax={percent === null ? undefined : 100}
            aria-valuenow={percent ?? undefined}
          >
            {percent !== null && <span class="block h-full rounded-full bg-accent" style={`width:${percent}%`} />}
          </span>
          <span class="shrink-0 text-note tabular-nums text-ink">
            {p.total === null ? t('runs.running.countOnly', { done: p.done }) : t('runs.running.count', { done: p.done, total: p.total })}
            {unit && <span class="text-ink-muted"> {unit}</span>}
          </span>
        </div>
      )}
      <ul class="mt-2 flex flex-wrap gap-x-2 text-note leading-5 tabular-nums text-ink-muted [&>li+li]:before:mr-2 [&>li+li]:before:text-ink-faint [&>li+li]:before:content-['·']">
        {counters.map((line) => (
          <li>{line}</li>
        ))}
        {p.etaSeconds !== null && <li>{t('runs.running.eta', { time: formatDuration(p.etaSeconds * 1000) })}</li>}
        {p.noEstimate && <li>{t('runs.running.noEstimate')}</li>}
        <li class={p.stale ? 'text-warn' : 'text-ink-faint'}>
          {t('runs.running.lastUpdate', { ago: formatDuration(p.updatedAgoMs) })}
          {p.stale && ` · ${t('runs.running.stalled')}`}
        </li>
      </ul>
    </>
  );
};
