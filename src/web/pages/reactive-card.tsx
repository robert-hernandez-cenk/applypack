/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import type { ConnectionView } from '../../resume/reactive-connection';
import type { MessageKey } from '../../i18n/catalog';
import { t } from '../../i18n/t';
import { tRich } from '../rich';
import { Button, ConfirmAction, Field, Hint, Input, SUBMIT_ONCE } from '../ui';

/*
 * The body of the Reactive Resume section on Settings → Job search (ADR 0075).
 * It gets a `ConnectionView`, which has no key in it: the card shows where the
 * connection points and never any part of the key, and the key field of the
 * replace form always starts empty. The host is the person's own text:
 * `translate="no"`.
 */

export const ReactiveCardBody: FC<{ view: ConnectionView | null }> = ({ view }) => (
  <>
    {view && (
      <p class="text-sm text-ink">
        {tRich('reactive.connected', {}, { host: () => <span translate="no" class="font-medium">{view.host}</span> })}
      </p>
    )}
    <form method="post" action="/settings/reactive-resume" class="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
      <Field label={t('resumes.reactive.url')} hint={t('resumes.reactive.urlHint')}>
        <Input
          type="text"
          name="url"
          required
          value={view?.base}
          placeholder="https://rxresu.me"
          translate="no"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
        />
      </Field>
      <Field label={t('resumes.reactive.key')} hint={t('resumes.reactive.keyHint')}>
        <Input type="password" name="key" required autocomplete="off" spellcheck="false" />
      </Field>
      <div class="flex items-end">
        <Button class="w-full">{t('reactive.save')}</Button>
      </div>
      {view && <Hint class="sm:col-span-3">{t('reactive.replaceHint')}</Hint>}
    </form>
    {view && (
      <div class="flex flex-wrap items-center gap-2">
        <ConfirmAction action="/settings/reactive-resume/remove" label={t('reactive.remove')} confirm={t('reactive.removeConfirm')} variant="danger" size="md" />
      </div>
    )}
  </>
);

/**
 * Where a saved connection is used (ADR 0075): a button that lists the
 * person's Reactive Resume resumes, or — with no connection — a pointer to the
 * card that makes one. The pick page follows the POST.
 */
export const ReactiveSource: FC<{ connected: boolean; action: string; button: string; hint: string; pointer: MessageKey }> = ({
  connected,
  action,
  button,
  hint,
  pointer,
}) =>
  connected ? (
    <form method="post" action={action} onsubmit={SUBMIT_ONCE} class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
      <Button variant="secondary">{button}</Button>
      <Hint class="min-w-0 sm:flex-1">{hint}</Hint>
    </form>
  ) : (
    <Hint>
      {tRich(pointer, {}, { link: (words) => <a href={REACTIVE_SETTINGS_HREF} class="text-accent-strong underline underline-offset-2">{words}</a> })}
    </Hint>
  );

const REACTIVE_SETTINGS_HREF = '/settings?tab=profile#reactive-resume';
