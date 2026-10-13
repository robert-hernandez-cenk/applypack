/** @jsxImportSource hono/jsx */
import type { MiddlewareHandler } from 'hono';
import { mayRequest } from '../users/admin-policy';
import { t } from '../i18n/t';
import { currentUser, isUserless } from './current-user';
import { Layout } from './layout';
import { Button, Card, PageHeader } from './ui';

/*
 * What runs the install is an administrator's (ADR 0070). One check in front
 * of every route, decided by the pure table in users/admin-policy.ts: a member
 * who asks for an administrator's page or posts an administrator's form gets a
 * 403 before any handler, body parser or store runs.
 */

/** The wizard used to be everybody's front door: an old bookmark takes a member home instead of to an error. */
const WIZARD = '/welcome';

export function requireAdmin(): MiddlewareHandler {
  return async (c, next) => {
    if (isUserless(c.req.path) || mayRequest(currentUser(), c.req.method, c.req.path)) return next();
    if (c.req.method === 'GET' && c.req.path === WIZARD) return c.redirect('/', 303);
    // The progress pages poll these and read JSON.
    if (c.req.path.endsWith('/state')) return c.json({ error: 'forbidden' }, 403);
    return c.html(
      <Layout title={t('admin.forbidden.title')}>
        <PageHeader title={t('admin.forbidden.title')} />
        <Card>
          <p class="text-note text-ink">{t('admin.forbidden.body')}</p>
          <div class="mt-4">
            <Button href="/" variant="secondary">
              {t('admin.forbidden.home')}
            </Button>
          </div>
        </Card>
      </Layout>,
      403,
    );
  };
}
