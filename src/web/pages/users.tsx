/** @jsxImportSource hono/jsx */
import type { FC } from 'hono/jsx';
import { Layout } from '../layout';
import { ActionForm, Badge, Button, Card, ConfirmAction, Flash, Hint, Notice, PageHeader, Table, Td, Tr } from '../ui';
import type { FlashMessage } from '../flash';
import { formatDate, formatRelative } from '../format';
import { userDeleteConfirm } from '../delete-confirm';
import type { UserSummary } from '../../users/store';
import { t } from '../../i18n/t';

/*
 * The users page (ADR 0070): who is on the installation, what role, and the
 * two things an administrator does about it. The rules (nobody acts on
 * themselves, the last administrator stays) are users/rules.ts; this page only
 * offers the buttons and the route answers the refusal in words.
 */

export interface UsersPageProps {
  users: UserSummary[];
  /** The signed-in administrator: their own row has no buttons. */
  selfId: number;
  /** Sign-in is configured; without it there is one implicit administrator and the page says so. */
  signIn: boolean;
  flash?: FlashMessage | null;
}

export const UsersPage: FC<UsersPageProps> = ({ users, selfId, signIn, flash }) => (
  <Layout title={t('nav.users')} active="users">
    <PageHeader title={t('nav.users')}>{t('users.desc')}</PageHeader>
    <Flash flash={flash} />
    <div class="space-y-4">
      {!signIn && <Notice tone="warn">{t('users.noSignIn')}</Notice>}
      <Card flush>
        <Table
          caption={t('users.caption')}
          hideBelow={['', '', 'md', 'sm', 'lg', '']}
          columns={[
            t('users.col.name'),
            t('users.col.role'),
            t('users.col.joined'),
            t('users.col.lastActive'),
            t('users.col.data'),
            <span class="block text-right">{t('common.actions')}</span>,
          ]}
        >
          {users.map((u) => {
            const self = u.id === selfId;
            const admin = u.role === 'ADMIN';
            return (
              <Tr>
                <Td class="max-w-[14rem] font-medium text-ink">
                  <div class="truncate" title={u.name} translate="no">
                    {u.name}
                  </div>
                  {self && <Hint>{t('users.you')}</Hint>}
                </Td>
                <Td>
                  <Badge tone={admin ? 'ok' : 'neutral'}>{admin ? t('users.role.admin') : t('users.role.member')}</Badge>
                </Td>
                <Td class="text-ink-muted">{formatDate(u.createdAt)}</Td>
                <Td class="text-ink-muted">{u.lastActiveAt ? formatRelative(u.lastActiveAt) : t('users.never')}</Td>
                <Td class="text-meta text-ink-muted">{t('users.dataLine', { postings: u.postings, resumes: u.resumes })}</Td>
                <Td>
                  {!self && (
                    <div class="flex flex-wrap justify-end gap-2">
                      <ActionForm action={`/users/${u.id}/role`} hidden={{ role: admin ? 'MEMBER' : 'ADMIN' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={t(admin ? 'users.makeMemberNamed' : 'users.makeAdminNamed', { name: u.name })}
                        >
                          {t(admin ? 'users.makeMember' : 'users.makeAdmin')}
                        </Button>
                      </ActionForm>
                      <ConfirmAction
                        action={`/users/${u.id}/delete`}
                        label={t('users.remove')}
                        ariaLabel={t('users.removeNamed', { name: u.name })}
                        confirm={userDeleteConfirm(u.name, u)}
                      />
                    </div>
                  )}
                </Td>
              </Tr>
            );
          })}
        </Table>
      </Card>
    </div>
  </Layout>
);
