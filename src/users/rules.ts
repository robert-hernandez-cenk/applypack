import type { UserRole } from './identity';

/*
 * What an administrator may do to a user (ADR 0070). Pure: the store reads
 * the users, asks here, and acts only on `ok`.
 */

export type UserChange = 'promote' | 'demote' | 'remove';

export type ChangeVerdict =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'self' | 'last-admin' | 'no-change' };

export interface UserRoleRow {
  id: number;
  role: UserRole;
}

/**
 * Nobody demotes or removes themselves (another administrator does that: a
 * misclick must not lock a person out), and the last administrator is never
 * demoted or removed, whoever asks — two administrators acting at once re-ask
 * on a fresh read inside one transaction.
 */
export function judgeUserChange(input: { users: readonly UserRoleRow[]; actorId: number; targetId: number; change: UserChange }): ChangeVerdict {
  const target = input.users.find((u) => u.id === input.targetId);
  if (!target) return { ok: false, reason: 'not-found' };
  if (input.change === 'promote') return target.role === 'ADMIN' ? { ok: false, reason: 'no-change' } : { ok: true };
  if (input.change === 'demote' && target.role !== 'ADMIN') return { ok: false, reason: 'no-change' };
  if (input.actorId === input.targetId) return { ok: false, reason: 'self' };
  const admins = input.users.filter((u) => u.role === 'ADMIN').length;
  if (target.role === 'ADMIN' && admins <= 1) return { ok: false, reason: 'last-admin' };
  return { ok: true };
}
