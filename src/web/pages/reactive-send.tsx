/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import { Layout } from '../layout';
import { Badge, Button, Card, Hint, PageHeader, SectionTitle, SUBMIT_ONCE, Table, Td, Tr } from '../ui';
import { t } from '../../i18n/t';
import type { EditReport } from '../../resume/reactive-resume-apply';
import type { SendFailure } from '../../resume/reactive-resume-writeback';
import { EDIT_KIND, EDIT_REASON, SEND_FAILURE } from '../reactive-failures';

/*
 * What a send to Reactive Resume came to (ADR 0079): rendered by the POST
 * itself, not carried in a cookie, because it lists every edit that could not
 * be placed and links to the new resume. The words of a model or a resume are
 * data (`translate="no"`); the reasons are the reader's language.
 */

/** Where the person goes on from the result: the page they sent from. */
export interface SendBack {
  href: string;
  label: string;
  /** The label is a name of the person's own (a resume's), not words to translate. */
  labelIsData?: boolean;
}

/** A resume that exists on the instance, by the name it was given and the address that opens it. */
export interface SentResume {
  name: string;
  openHref: string;
}

export type SendOutcome =
  | { ok: true; sent: SentResume; applied: number; notApplied: EditReport[] }
  | { ok: false; code: SendFailure; created?: SentResume; maybeCreated?: boolean; notApplied?: EditReport[] };

/** Press to send a tailored copy as a new resume; `back` says which page it was pressed on, and `matchId` which comparison to come back to. */
export const ReactiveSendButton: FC<{ copyId: number; jobTitle: string; back: 'resume' | 'target'; matchId?: number }> = ({
  copyId,
  jobTitle,
  back,
  matchId,
}) => (
  <form method="post" action={`/tailored/${copyId}/reactive-send`} onsubmit={SUBMIT_ONCE} class="inline">
    <input type="hidden" name="back" value={back} />
    {matchId !== undefined && <input type="hidden" name="match" value={String(matchId)} />}
    <Button variant="secondary" size="sm" aria-label={t('reactive.send.aria', { job: jobTitle })}>
      {t('reactive.send.button')}
    </Button>
  </form>
);

const OpenLink: FC<{ sent: SentResume }> = ({ sent }) => (
  <p class="mt-2 text-sm">
    <span class="font-medium text-ink" translate="no">
      {sent.name}
    </span>
    {' · '}
    <a href={sent.openHref} rel="noopener noreferrer" target="_blank" class="text-accent-strong underline underline-offset-2 hover:no-underline">
      {t('reactive.send.open')}
    </a>
  </p>
);

const NotAppliedTable: FC<{ edits: EditReport[] }> = ({ edits }) => (
  <Card class="mt-4" flush>
    <div class="p-5 pb-3">
      <SectionTitle>{t('reactive.send.notApplied', { n: edits.length })}</SectionTitle>
      <Hint>{t('reactive.send.notAppliedHint')}</Hint>
    </div>
    <Table columns={[t('reactive.send.col.edit'), t('reactive.send.col.line'), t('reactive.send.col.why')]}>
      {edits.map((e) => (
        <Tr>
          <Td class="whitespace-nowrap align-top">
            <Badge tone="neutral">{t(EDIT_KIND[e.kind])}</Badge>
            <div class="mt-1 text-note text-ink-faint" translate="no">
              {e.label || t('reactive.send.noLabel')}
            </div>
          </Td>
          <Td class="align-top">
            <span class="break-words" translate="no">
              {e.line}
            </span>
          </Td>
          <Td class="align-top text-ink-muted">{e.reason ? t(EDIT_REASON[e.reason]) : ''}</Td>
        </Tr>
      ))}
    </Table>
  </Card>
);

export const ReactiveSendPage: FC<{ outcome: SendOutcome; jobTitle: string; back: SendBack }> = ({ outcome, jobTitle, back }) => (
  <Layout title={outcome.ok ? t('reactive.send.titleOk') : t('reactive.send.titleFail')} active="resumes">
    <PageHeader title={outcome.ok ? t('reactive.send.titleOk') : t('reactive.send.titleFail')} back={back}>
      <span translate="no">{jobTitle}</span>
    </PageHeader>
    {outcome.ok ? (
      <>
        <Card>
          <p class="text-sm text-ink">{t('reactive.send.ok')}</p>
          <OpenLink sent={outcome.sent} />
          <Hint class="mt-3">{t('reactive.send.applied', { n: outcome.applied })}</Hint>
        </Card>
        {outcome.notApplied.length > 0 && <NotAppliedTable edits={outcome.notApplied} />}
      </>
    ) : (
      <>
        <Card>
          <p class="text-sm text-ink">{t(SEND_FAILURE[outcome.code])}</p>
          {outcome.maybeCreated && <Hint class="mt-3">{t('reactive.send.mayHaveCreated')}</Hint>}
          {outcome.created && (
            <div class="mt-3">
              <Hint>{t('reactive.send.createdLeft')}</Hint>
              <OpenLink sent={outcome.created} />
            </div>
          )}
        </Card>
        {outcome.notApplied && outcome.notApplied.length > 0 && <NotAppliedTable edits={outcome.notApplied} />}
      </>
    )}
  </Layout>
);

/** A result asked for after it was forgotten (a day-old link, another person's): said so, with the way on. */
export const ReactiveSentGonePage: FC = () => (
  <Layout title={t('reactive.send.titleFail')} active="resumes">
    <PageHeader title={t('reactive.send.titleFail')} back={{ href: '/resumes', label: t('nav.resumes') }} />
    <Card>
      <p class="text-sm text-ink">{t('reactive.send.expired')}</p>
    </Card>
  </Layout>
);
