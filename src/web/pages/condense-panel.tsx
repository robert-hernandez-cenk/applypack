/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import { Button, Field, Hint, Select, SUBMIT_ONCE } from '../ui';
import { condensePanel, type CondenseStage } from '../../resume/condense';
import { PAGE_TARGETS, type LengthPlan } from '../../resume/length';
import type { MatchAction, MatchRemoval } from '../../resume/prompts';
import { ActionsBlock, RemovalsBlock } from './resume-match-card';
import { t } from '../../i18n/t';

/**
 * Condense on the editor page (ADR 0078): three steps the person starts one at
 * a time, each reviewed before the next. Expanded when the resume is over its
 * page target or a step already has something to review; collapsed and still
 * available otherwise. The wording step and the refresh read the editor's text
 * through a hidden field target-page.mjs keeps in step with it.
 */
export const CondensePanel: FC<{
  jobId: number;
  matchId: number;
  plan: LengthPlan;
  stage: CondenseStage;
  /** The cuts of the comparison, from Find cuts - or, on an older row, from the comparison itself. */
  removals: MatchRemoval[];
  rewrites: MatchAction[];
  /** A full analysis: the refresh needs one. */
  full: boolean;
}> = ({ jobId, matchId, plan, stage, removals, rewrites, full }) => {
  const base = `/jobs/${jobId}/matches/${matchId}/condense`;
  const stateKey = stage !== 'none' ? 'condense.state.started' : !plan.met ? 'condense.state.over' : plan.target === 'keep' ? 'condense.state.keep' : 'condense.state.within';
  return (
    <details id="condense" class="rounded-md border border-line" open={condensePanel(plan, stage).open}>
      <summary class="cursor-pointer px-3 py-2 text-sm font-medium text-ink">
        {t('condense.heading')} <span class="font-normal text-ink-muted">· {t(stateKey, { target: plan.target === 'keep' ? 0 : plan.target })}</span>
      </summary>
      <div class="space-y-4 border-t border-line p-3">
        <Hint>{t('condense.intro')}</Hint>

        <section aria-labelledby="condense-cuts-title">
          <div id="condense-cuts-title" class="mb-1 text-note font-medium text-ink-muted">
            {t('condense.cuts.title')}
          </div>
          <form method="post" action={`${base}/cuts`} onsubmit={SUBMIT_ONCE} class="space-y-2">
            {/* The target is set here and kept on the comparison (ADR 0074); the editor's meter follows the choice (target-page.mjs). */}
            <Field label={t('target.pages.label')} class="min-w-0 max-w-full sm:max-w-xs">
              <Select name="pages" id="condense-pages" class="!w-auto max-w-full">
                <option value="keep" selected={plan.target === 'keep'}>
                  {t('target.pages.keep')}
                </option>
                {PAGE_TARGETS.map((n) => (
                  <option value={String(n)} selected={plan.target === n}>
                    {t('target.pages.n', { n })}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="secondary" size="sm">
              {stage === 'none' ? t('condense.cuts.button') : t('condense.cuts.again')}
            </Button>
          </form>
          <Hint class="mt-1.5">{t('condense.cuts.hint')}</Hint>
          {stage === 'none' && removals.length > 0 && <Hint class="mt-1.5">{t('condense.cuts.older')}</Hint>}
          {stage !== 'none' && removals.length === 0 && <Hint class="mt-1.5">{t('condense.cuts.none')}</Hint>}
          <div class="mt-2">
            <RemovalsBlock removals={removals} interactive />
          </div>
        </section>

        <section aria-labelledby="condense-words-title">
          <div id="condense-words-title" class="mb-1 text-note font-medium text-ink-muted">
            {t('condense.words.title')}
          </div>
          {stage === 'none' ? (
            <Hint>{t('condense.words.locked')}</Hint>
          ) : (
            <>
              <form method="post" action={`${base}/words`} onsubmit={SUBMIT_ONCE}>
                <input type="hidden" name="text" value="" data-editor-text />
                <Button variant="secondary" size="sm">
                  {stage === 'rewrites' ? t('condense.words.again') : t('condense.words.button')}
                </Button>
              </form>
              <Hint class="mt-1.5">{t('condense.words.hint')}</Hint>
              {stage === 'rewrites' && rewrites.length === 0 && <Hint class="mt-1.5">{t('condense.words.none')}</Hint>}
              {rewrites.length > 0 && (
                <div class="mt-2">
                  <ActionsBlock actions={rewrites} interactive heading={t('condense.words.heading', { n: rewrites.length })} />
                </div>
              )}
            </>
          )}
        </section>

        {full && (
          <section aria-labelledby="condense-refresh-title">
            <div id="condense-refresh-title" class="mb-1 text-note font-medium text-ink-muted">
              {t('condense.refresh.title')}
            </div>
            <form method="post" action={`${base}/refresh`} onsubmit={SUBMIT_ONCE}>
              <input type="hidden" name="text" value="" data-editor-text />
              <Button variant="ghost" size="sm">
                {t('condense.refresh.button')}
              </Button>
            </form>
            <Hint class="mt-1.5">{t('condense.refresh.hint')}</Hint>
          </section>
        )}
      </div>
    </details>
  );
};
