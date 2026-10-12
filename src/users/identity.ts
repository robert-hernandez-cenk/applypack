/*
 * Who is using the install (ADR 0065). Pure: the shapes, the default user's
 * id and the one decision about a first sign-in. `store.ts` is the part that
 * touches the database.
 *
 * Convention for code that serves a person: a dashboard handler reads
 * `currentUser()` (web/current-user.ts); the worker has no request, so a job
 * that works on someone's data takes `userId: number` as an argument and the
 * caller says whose. Until a slice scopes a table, the only user is
 * `DEFAULT_USER_ID`.
 */

export type UserRole = 'ADMIN' | 'MEMBER';

export interface CurrentUser {
  id: number;
  name: string;
  role: UserRole;
}

/** The row the migration creates; owner of everything stored before users existed. */
export const DEFAULT_USER_ID = 1;

/** What an install with no sign-in runs as when the users table cannot be read. */
export const FALLBACK_USER: CurrentUser = { id: DEFAULT_USER_ID, name: 'Default user', role: 'ADMIN' };

/** What the provider says about a person: its stable id and a name to show. */
export interface Identity {
  sub: string;
  name: string | null;
}

export type ProvisionStep = 'known' | 'claim-default' | 'create';

/**
 * A person who signs in is already a user, or takes over the default user
 * (the first person to sign in inherits what the install held before and is
 * its admin), or becomes a new member.
 */
export function provisionStep(state: { known: boolean; defaultUnclaimed: boolean }): ProvisionStep {
  if (state.known) return 'known';
  return state.defaultUnclaimed ? 'claim-default' : 'create';
}
