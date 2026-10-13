import { prisma, isUniqueViolation } from '../db';
import { DEFAULT_USER_ID, provisionStep, type CurrentUser, type Identity } from './identity';

/** The only file that touches `users` (ADR 0065). */

export async function loadUser(id: number): Promise<CurrentUser | null> {
  const row = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } });
  return row;
}

/**
 * The user a provider identity stands for, created on first sight. Returns the id.
 * Two first sign-ins at once settle on the unique `oidcSub`: the loser reads the winner's row.
 */
export async function provisionOidcUser(identity: Identity): Promise<number> {
  const name = identity.name ?? identity.sub;
  const known = await prisma.user.findUnique({ where: { oidcSub: identity.sub }, select: { id: true } });
  const defaultUnclaimed =
    !known && (await prisma.user.count({ where: { id: DEFAULT_USER_ID, oidcSub: null } })) === 1;
  const step = provisionStep({ known: known !== null, defaultUnclaimed });
  if (step === 'known' && known) return known.id;
  if (step === 'claim-default') {
    // Guarded by `oidcSub: null`, so of two simultaneous first sign-ins only one takes it.
    const claimed = await prisma.user.updateMany({ where: { id: DEFAULT_USER_ID, oidcSub: null }, data: { oidcSub: identity.sub, name } });
    if (claimed.count === 1) return DEFAULT_USER_ID;
  }
  try {
    const created = await prisma.user.create({ data: { oidcSub: identity.sub, name, role: 'MEMBER' }, select: { id: true } });
    return created.id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const won = await prisma.user.findUniqueOrThrow({ where: { oidcSub: identity.sub }, select: { id: true } });
    return won.id;
  }
}

/** The administrators: who hears an operator notice (ADR 0069). */
export async function listAdminIds(): Promise<number[]> {
  const rows = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, orderBy: { id: 'asc' } });
  return rows.map((r) => r.id);
}

/** Every user's id: a posting stored without a verdict is handed to all of them (ADR 0067). */
export async function listUserIds(): Promise<number[]> {
  const rows = await prisma.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  return rows.map((r) => r.id);
}
