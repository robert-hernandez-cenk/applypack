import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { APP_VERSION } from '../../app-version';
import { currentLocale } from '../../i18n/locale';
import { t } from '../../i18n/t';
import { currentTheme, themeAttr } from '../theme';
import { rootBlock } from '../tokens';

/*
 * The two pages a person sees outside the app: sign-in did not complete, and
 * signed out (ADR 0064). Written as plain templates rather than JSX so they
 * can be rendered by the tests; they carry the dashboard's stylesheet and
 * tokens but none of its menu, which would name every page to someone who may
 * not enter.
 */

const BUTTON_CLASS =
  'inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent-strong px-3.5 py-1.5 text-sm font-medium text-on-accent shadow-sm transition-colors duration-150 hover:bg-accent-deep';

/** The page's forced look, as an attribute; nothing for System. The value is one of two words, never text from a request. */
function themeAttribute(): string {
  const theme = themeAttr(currentTheme());
  return theme ? ` data-theme="${theme}"` : '';
}

function notice(title: string, body: string, href: string, action: string): HtmlEscapedString | Promise<HtmlEscapedString> {
  return html`${raw('<!DOCTYPE html>')}
    <html lang="${currentLocale()}"${raw(themeAttribute())}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title} · ApplyPack</title>
        <link rel="stylesheet" href="/static/tailwind.css?v=${APP_VERSION}" />
        <style>
          ${raw(rootBlock())}
          html, body { background-color: rgb(var(--surface)); }
        </style>
      </head>
      <body class="bg-surface font-sans text-sm text-ink antialiased">
        <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
          <h1 class="text-title text-ink">${title}</h1>
          <p class="text-ink-muted">${body}</p>
          <div><a href="${href}" class="${BUTTON_CLASS}">${action}</a></div>
        </main>
      </body>
    </html>`;
}

export function signInFailedPage(loginHref: string): HtmlEscapedString | Promise<HtmlEscapedString> {
  return notice(t('oidc.failed.title'), t('oidc.failed.body'), loginHref, t('oidc.failed.retry'));
}

export function signedOutPage(loginHref: string): HtmlEscapedString | Promise<HtmlEscapedString> {
  return notice(t('oidc.signedOut.title'), t('oidc.signedOut.body'), loginHref, t('oidc.signedOut.signIn'));
}
