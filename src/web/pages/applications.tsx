/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import { Layout } from '../layout';
import { Badge, Button, Empty, FitBadge, Flash, PageHeader } from '../ui';
import { Icon } from '../icons';
import type { FlashMessage } from '../flash';
import type { Tone } from '../format';
import { PRE_APPLY_KEYS } from '../../applied-state';
import {
  allStages,
  boardStages,
  dotClassFor,
  NO_OFFER_DROP_STAGE,
  NO_OFFER_STAGE,
  nextStageKey,
  TERMINAL_KEYS,
  TERMINAL_STAGES,
  UNFILED_STAGE,
  wordedStage,
  type StageDef,
} from '../stage-config';
import type { StageTimeLine } from '../stage-time';
import { t } from '../../i18n/t';

export interface ApplicationCard {
  id: number;
  title: string;
  companyName: string;
  fitScore: number | null;
  recruiterContact: string | null;
  stageLine: StageTimeLine | null;
}

export interface ApplicationsProps {
  byStage: Record<string, ApplicationCard[]>;
  /** Configured work columns (ADR 0025) — entry and exits are fixed. */
  work: StageDef[];
  /** Some jobs hold a stage no column covers, so "Unfiled" is shown. */
  stranded?: boolean;
  applicationTrackingEnabled: boolean;
  flash?: FlashMessage | null;
}

/**
 * One board card: the link navigates, the form below it quick-moves, and
 * board.mjs makes the whole card draggable. With drag active (body[data-dnd],
 * fine pointer, md+) the form collapses until the card has hover or focus —
 * it stays the keyboard and no-JS path.
 */
const PRE_APPLY_STAGES: readonly string[] = PRE_APPLY_KEYS;

const END_BADGE_TONE: Record<string, Tone> = { rejected: 'danger', ghosted: 'neutral', expired: 'warn' };

/** A card in the No Offer column says which end state it is in: a word, never just a colour. */
const EndBadge: FC<{ stage: StageDef }> = ({ stage }) => (
  <Badge tone={END_BADGE_TONE[stage.key] ?? 'neutral'} class="shrink-0">
    {stage.label}
  </Badge>
);

const StageCard: FC<{ card: ApplicationCard; stage: string; work: StageDef[]; badge?: StageDef }> = ({
  card,
  stage,
  work,
  badge,
}) => (
  <li
    class="rounded-md border border-line bg-surface-raised shadow-sm"
    data-job-id={card.id}
    data-stage={stage}
  >
    <a
      href={`/jobs/${card.id}`}
      class="block rounded-t-md p-3 transition-colors duration-150 hover:bg-surface-overlay/60"
    >
      <div class="line-clamp-2 text-sm font-medium leading-snug text-ink" translate="no">
        {card.title}
      </div>
      <div class="mt-1 truncate text-note text-ink-muted" translate="no">
        {card.companyName}
      </div>
      {badge && (
        <div class="mt-2">
          <EndBadge stage={badge} />
        </div>
      )}
      <div class="mt-2 flex items-center justify-between gap-2">
        <span
          class={`min-w-0 truncate text-meta ${
            card.stageLine?.stale ? 'font-medium text-warn' : 'text-ink-faint'
          }`}
          title={card.stageLine?.since.toISOString().slice(0, 10)}
        >
          {/* Nothing has been sent from Consider or Applying, so "no apply date" would say something is missing. */}
          {card.stageLine?.text ?? (PRE_APPLY_STAGES.includes(stage) ? '' : t('applications.noApplyDate'))}
          {card.recruiterContact ? ` · ${card.recruiterContact}` : ''}
        </span>
        <FitBadge score={card.fitScore} />
      </div>
    </a>
    <form
      method="post"
      action={`/jobs/${card.id}/stage`}
      class="quick-move flex items-center gap-1.5 border-t border-line px-2 py-1.5"
    >
      <label class="sr-only" for={`move-${card.id}`}>
        {t('applications.moveToStage', { title: card.title })}
      </label>
      <select
        id={`move-${card.id}`}
        name="toStage"
        class="h-8 w-full min-w-0 flex-1 rounded-md border border-line-strong bg-surface-raised px-1.5 text-meta text-ink shadow-sm transition-colors duration-150 hover:border-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
      >
        {allStages(work)
          .filter((s) => s.key !== stage)
          .map((s) => (
            <option value={s.key} selected={s.key === nextStageKey(work, stage)} translate={wordedStage(s) ? undefined : 'no'}>
              {s.label}
            </option>
          ))}
      </select>
      <Button size="sm" variant="secondary" aria-label={t('applications.moveCard', { title: card.title })}>
        {t('applications.move')}
      </Button>
    </form>
  </li>
);

/** A column's name: the user's own stays as typed (`translate="no"`); one ApplyPack names is translated. */
const StageName: FC<{ stage: StageDef }> = ({ stage }) =>
  wordedStage(stage) ? <>{stage.label}</> : <span translate="no">{stage.label}</span>;

const ColumnHeader: FC<{ dot: string; id: string; stage: StageDef; count: number; toggleFor?: string }> = ({
  dot,
  id,
  stage,
  count,
  toggleFor,
}) => (
  <div class="col-header flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
    <span class={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
    <h2 id={id} class="col-title text-label text-ink">
      <StageName stage={stage} />
    </h2>
    <span class="col-count ml-auto text-meta text-ink-faint tabular-nums">{count}</span>
    {toggleFor && (
      // Desktop only: a phone stacks the columns, so there is nothing to fold. board.mjs-style script
      // (column-collapse.mjs) keeps aria-expanded and the name in step; without it the column is just open.
      <button
        type="button"
        data-collapse-toggle
        aria-expanded="true"
        aria-controls={toggleFor}
        aria-label={t('browser.board.collapseNoOffer')}
        class="col-toggle hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:inline-flex"
      >
        <span class="col-chevron inline-flex" aria-hidden="true">
          <Icon name="chevron-left" size={16} />
        </span>
      </button>
    )}
  </div>
);

/*
 * Drag styling: with board.mjs active the quick-move form collapses until
 * its card has hover or keyboard focus (focus-within keeps the tab path —
 * the controls stay tabbable, unlike display:none). md+ and body[data-dnd]
 * only, so mobile and no-JS keep the always-visible form.
 */
const BOARD_CSS = `
  @media (min-width: 768px) {
    body[data-dnd] .quick-move { height: 0; padding-top: 0; padding-bottom: 0; border-top-width: 0; opacity: 0; overflow: hidden; }
    body[data-dnd] li[data-job-id]:hover .quick-move,
    body[data-dnd] li[data-job-id]:focus-within .quick-move { height: auto; padding-top: 0.375rem; padding-bottom: 0.375rem; border-top-width: 1px; opacity: 1; }
    body[data-dnd] li[data-job-id] { cursor: grab; }
    body[data-dnd] li[data-job-id]:active { cursor: grabbing; }
    /* The No Offer column folded to a rail: title and count stay, the cards go (ADR 0080). md+ only. */
    [data-collapsible] { transition: width 150ms ease; }
    [data-collapsible][data-collapsed="true"] { width: 3rem; }
    [data-collapsible][data-collapsed="true"] .col-body { display: none; }
    [data-collapsible][data-collapsed="true"] .col-header { flex-direction: column-reverse; align-items: center; justify-content: flex-end; padding-left: 0; padding-right: 0; gap: 0.75rem; }
    [data-collapsible][data-collapsed="true"] .col-title { writing-mode: vertical-rl; }
    [data-collapsible][data-collapsed="true"] .col-count { margin-left: 0; }
    [data-collapsible] .col-chevron { transform: rotate(180deg); }
    [data-collapsible][data-collapsed="true"] .col-chevron { transform: none; }
  }
  @media (min-width: 768px) and (prefers-reduced-motion: reduce) {
    [data-collapsible] { transition: none; }
  }
`;

/* Coarse-pointer devices can't HTML5-drag reliably — keep their forms visible. */
const BOARD_BOOT = `
  const { initCollapse } = await import('/static/column-collapse.mjs');
  initCollapse(document);
  if (window.matchMedia('(pointer: fine)').matches) {
    const { initBoard } = await import('/static/board.mjs');
    initBoard(document);
  }
`;

export const ApplicationsPage: FC<ApplicationsProps> = ({
  byStage,
  work,
  stranded = false,
  applicationTrackingEnabled,
  flash,
}) => {
  const columns = boardStages(work);
  const count = (key: string) => byStage[key]?.length ?? 0;
  const activeCount = columns.reduce((sum, s) => sum + count(s.key), 0);
  // The end states are one column, No Offer; each card keeps its own state (ADR 0080).
  const noOfferCards = TERMINAL_STAGES.flatMap((s) => (byStage[s.key] ?? []).map((card) => ({ card, stage: s })));
  // "Unfiled" is an exception to look at, not a step of the funnel: it counts with No Offer
  // in the header and keeps a small panel of its own.
  const unfiledCount = stranded ? count(UNFILED_STAGE.key) : 0;
  const closedCount = noOfferCards.length + unfiledCount;

  return (
    <Layout title={t('applications.applications')} active="applications" fill>
      <PageHeader
        title={t('applications.applications')}
        meta={
          applicationTrackingEnabled
            ? t(closedCount > 0 ? 'applications.metaNoOffer' : 'applications.meta', { active: activeCount, noOffer: closedCount })
            : undefined
        }
        actions={
          applicationTrackingEnabled ? (
            <div class="flex flex-wrap items-center gap-2">
              {/* TASKS N7: the board as a file, for the spreadsheet people keep anyway. */}
              {activeCount + closedCount > 0 && (
                <>
                  <Button href="/applications/export.csv" variant="secondary" size="sm" title={t('applications.everyApplicationOneRowEach')}>
                    {t('applications.csv')}
                  </Button>
                  <Button href="/applications/export.md" variant="secondary" size="sm" title={t('applications.everyApplicationByColumn')}>
                    {t('applications.markdown')}
                  </Button>
                </>
              )}
              <Button href="/settings?tab=applications#stages" variant="ghost" size="sm">
                {t('applications.editColumns')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {applicationTrackingEnabled && t('applications.whereEachApplicationStandsDrag')}
      </PageHeader>
      <Flash flash={flash} />

      {!applicationTrackingEnabled ? (
        <Empty
          title={t('applications.applicationTrackingIsOff')}
          action={
            <Button href="/settings?tab=applications" variant="secondary" size="sm">
              {t('applications.turnItOnInSettings')}
            </Button>
          }
        >
          {t('applications.theBoardListsEveryJob')}
        </Empty>
      ) : (
        <>
        {/* TASKS U5: an empty board says how a card gets onto it, once, above the empty columns. */}
        {Object.values(byStage).every((items) => items.length === 0) && (
          <Empty
            title={t('applications.nothingOnTheBoardYet')}
            action={
              <Button href="/jobs" variant="secondary" size="sm">
                {t('applications.openYourJobs')}
              </Button>
            }
          >
            {t('applications.markAJobAppliedIn')}
          </Empty>
        )}
        <nav aria-label={t('applications.stages')} class="mb-3 flex flex-wrap gap-1.5 md:hidden">
          {columns.map((s) => (
            <a
              href={`#stage-col-${s.key}`}
              class="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-line bg-surface-raised px-3 text-meta text-ink-muted"
            >
              <StageName stage={s} />
              <span class="tabular-nums text-ink-faint">{count(s.key)}</span>
            </a>
          ))}
          <a
            href={`#stage-col-${NO_OFFER_STAGE.key}`}
            class="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-line bg-surface-raised px-3 text-meta text-ink-muted"
          >
            <StageName stage={NO_OFFER_STAGE} />
            <span class="tabular-nums text-ink-faint">{noOfferCards.length}</span>
          </a>
          {unfiledCount > 0 && (
            <a
              href="#unfiled"
              class="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-line bg-surface-raised px-3 text-meta text-ink-muted"
            >
              <StageName stage={UNFILED_STAGE} />
              <span class="tabular-nums text-ink-faint">{unfiledCount}</span>
            </a>
          )}
        </nav>
        {/* Layout fill gives the wrapper the viewport height; flex-1 hands
            the leftover to the board, so columns end at the window bottom
            and scroll inside. min-h keeps the board usable when the open
            Unfiled panel would otherwise squash it. */}
        <div class="flex min-h-[320px] min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-stretch md:overflow-x-auto md:pb-1">
          {columns.map((s) => {
            const items = byStage[s.key] ?? [];
            return (
              <section
                id={`stage-col-${s.key}`}
                data-drop-stage={s.key}
                class="flex w-full scroll-mt-4 flex-col rounded-lg bg-surface-overlay md:min-h-[320px] md:w-72 md:shrink-0"
                aria-labelledby={`stage-${s.key}`}
              >
                  <ColumnHeader
                    dot={dotClassFor(work, s.key)}
                    id={`stage-${s.key}`}
                    stage={s}
                    count={items.length}
                  />
                  <ul class="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                    {items.length === 0 ? (
                      // A quiet line, not a dashed well: the column's surface already says "a place to drop".
                      <li class="hidden px-1 py-1 text-meta text-ink-faint md:block">{t('applications.noApplications')}</li>
                    ) : (
                      items.map((c) => <StageCard card={c} stage={s.key} work={work} />)
                    )}
                  </ul>
              </section>
            );
          })}
          {/* The last column groups the end states. A drop lands as Rejected; a card already in the
              group stays as it is (data-drop-group), and each card names its own state in a badge. */}
          <section
            id={`stage-col-${NO_OFFER_STAGE.key}`}
            data-collapsible
            data-collapsed="false"
            data-drop-stage={NO_OFFER_DROP_STAGE}
            data-drop-group={TERMINAL_KEYS.join(' ')}
            class="flex w-full scroll-mt-4 flex-col overflow-hidden rounded-lg bg-surface-overlay md:min-h-[320px] md:w-72 md:shrink-0"
            aria-labelledby={`stage-${NO_OFFER_STAGE.key}`}
          >
            <ColumnHeader
              dot={dotClassFor(work, NO_OFFER_STAGE.key)}
              id={`stage-${NO_OFFER_STAGE.key}`}
              stage={NO_OFFER_STAGE}
              count={noOfferCards.length}
              toggleFor={`${NO_OFFER_STAGE.key}-body`}
            />
            <ul id={`${NO_OFFER_STAGE.key}-body`} class="col-body min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {noOfferCards.length === 0 ? (
                <li class="hidden px-1 py-1 text-meta text-ink-faint md:block">{t('applications.noApplications')}</li>
              ) : (
                noOfferCards.map(({ card, stage }) => <StageCard card={card} stage={stage.key} work={work} badge={stage} />)
              )}
            </ul>
          </section>
        </div>
        {unfiledCount > 0 && (
          <details id="unfiled" class="mt-4 scroll-mt-4 rounded-lg bg-surface-overlay">
            <summary class="cursor-pointer select-none rounded-lg px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink">
              <StageName stage={UNFILED_STAGE} />
              <span class="ml-2 text-meta font-normal text-ink-faint tabular-nums">{unfiledCount}</span>
            </summary>
            <div class="border-t border-line/70 p-4">
              <p data-ui="hint" class="pb-2 text-meta text-ink-faint">
                {t('applications.theColumnTheseWereIn')}
              </p>
              <ul class="space-y-2" aria-label={t('stages.unfiled')}>
                {(byStage[UNFILED_STAGE.key] ?? []).map((c) => (
                  <StageCard card={c} stage={UNFILED_STAGE.key} work={work} />
                ))}
              </ul>
            </div>
          </details>
        )}
        <style dangerouslySetInnerHTML={{ __html: BOARD_CSS }} />
        <script type="module" dangerouslySetInnerHTML={{ __html: BOARD_BOOT }} />
        </>
      )}
    </Layout>
  );
};
