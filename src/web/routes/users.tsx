/** @jsxImportSource hono/jsx */
import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../../db';
import { changeUser, listUserSummaries } from '../../users/store';
import type { ChangeVerdict, UserChange } from '../../users/rules';
import { UsersPage } from '../pages/users';
import { currentUser } from '../current-user';
import { signInEnabled } from '../oidc/enabled';
import { clearFlashCookie, flashRedirect, parseFlashCookie } from '../flash';
import { idParam } from '../params';
import { t } from '../../i18n/t';

/* The users page (ADR 0070). Every route here is administrators' only: web/admin-guard.tsx. */

export const usersRoute = new Hono();

const USERS = '/users';

const RoleSchema = z.object({ role: z.enum(['ADMIN', 'MEMBER']) });

usersRoute.get(USERS, async (c) => {
  return c.html(
    <UsersPage
      users={await listUserSummaries()}
      selfId={currentUser().id}
      signIn={signInEnabled()}
      flash={parseFlashCookie(c.req.header('cookie'))}
    />,
    200,
    { 'Set-Cookie': clearFlashCookie() },
  );
});

/** The refusal in words; the user's name is read before the change, because removal erases it. */
function refusal(verdict: Extract<ChangeVerdict, { ok: false }>, name: string): string {
  switch (verdict.reason) {
    case 'self':
      return t('users.flash.self');
    case 'last-admin':
      return t('users.flash.lastAdmin');
    case 'no-change':
      return t('users.flash.noChange', { name });
    case 'not-found':
      return t('users.flash.notFound');
  }
}

async function apply(targetId: number, change: UserChange): Promise<Response> {
  if (!Number.isFinite(targetId)) return flashRedirect(USERS, 'err', t('users.flash.notFound'));
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { name: true } });
  const name = target?.name ?? '';
  const verdict = await changeUser({ actorId: currentUser().id, targetId, change });
  if (!verdict.ok) return flashRedirect(USERS, 'err', refusal(verdict, name));
  const done = { promote: 'users.flash.promoted', demote: 'users.flash.demoted', remove: 'users.flash.removed' } as const;
  return flashRedirect(USERS, 'ok', t(done[change], { name }));
}

usersRoute.post('/users/:id/role', async (c) => {
  const parsed = RoleSchema.safeParse(await c.req.parseBody());
  const targetId = idParam(c.req.param('id'));
  if (!parsed.success) return flashRedirect(USERS, 'err', t('users.flash.notFound'));
  return apply(targetId, parsed.data.role === 'ADMIN' ? 'promote' : 'demote');
});

usersRoute.post('/users/:id/delete', async (c) => apply(idParam(c.req.param('id')), 'remove'));
