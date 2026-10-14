/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import type { CardView } from '../../gmail/card-view';
import { DEFAULT_LABEL, MAX_LABEL_CHARS } from '../../gmail/settings';
import { t } from '../../i18n/t';
import { formatDate } from '../format';
import { tRich } from '../rich';
import { ActionForm, Button, ConfirmAction, Field, Hint, Input, Notice } from '../ui';

/*
 * The body of the Gmail section on Settings → Job search (ADR 0071). It gets a
 * `CardView`, which has no token in it, and lays out what that says. The
 * account address and the label are the person's own text: `translate="no"`.
 */

const FAILED = new Set(['gmail.status.accessEnded', 'gmail.status.labelMissing', 'gmail.status.noEngine', 'gmail.status.error']);

export const GmailCardBody: FC<{ view: CardView }> = ({ view }) => {
  if (view.state === 'unconfigured') return <Hint>{t('gmail.unconfigured')}</Hint>;
  if (view.state === 'disconnected') {
    return (
      <div class="flex flex-wrap items-center gap-3">
        <Button href="/gmail/connect" variant="primary">
          {t('gmail.connect')}
        </Button>
      </div>
    );
  }
  const { statusKey, lastCheck } = view;
  return (
    <>
      <p class="text-sm text-ink">
        {tRich('gmail.account', {}, { account: () => <span translate="no" class="font-medium">{view.account}</span> })}
      </p>
      {statusKey &&
        (FAILED.has(statusKey) ? (
          <Notice tone={statusKey === 'gmail.status.error' ? 'danger' : 'warn'} role="status">
            {t(statusKey)}
          </Notice>
        ) : (
          <Hint>{t(statusKey)}</Hint>
        ))}
      <Hint>
        {lastCheck ? t('gmail.lastCheck', { when: formatDate(lastCheck.at), mails: lastCheck.mails, listings: lastCheck.listings }) : t('gmail.neverChecked')}
      </Hint>

      <form method="post" action="/gmail/label" class="flex flex-wrap items-end gap-2">
        <Field label={t('gmail.labelLabel')} hint={t('gmail.labelHint')} class="min-w-0 flex-1">
          <Input name="label" value={view.label ?? DEFAULT_LABEL} maxlength={MAX_LABEL_CHARS} placeholder={DEFAULT_LABEL} translate="no" />
        </Field>
        <Button variant="secondary">{t('gmail.labelSave')}</Button>
      </form>

      <div class="flex flex-wrap items-center gap-2">
        {view.state === 'ended' && view.canConnect && (
          <Button href="/gmail/connect" variant="primary">
            {t('gmail.reconnect')}
          </Button>
        )}
        <ActionForm action="/gmail/check">
          <Button variant="secondary" disabled={view.queued}>
            {t('gmail.checkNow')}
          </Button>
        </ActionForm>
        <ConfirmAction action="/gmail/disconnect" label={t('gmail.disconnect')} confirm={t('gmail.disconnectConfirm')} variant="danger" size="md" />
        {view.queued && <Hint>{t('gmail.checkQueued')}</Hint>}
      </div>
    </>
  );
};
