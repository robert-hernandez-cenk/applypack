import type { CurrentUser } from './identity';

/*
 * Who may use which route (ADR 0070). Pure: two lists and the matcher.
 *
 * Every route the dashboard registers is in exactly one of them. `admin` is
 * what runs the install for everybody (sources, fetching, the AI engine,
 * employer mode, the wizard, users); `personal` is what a signed-in person
 * does with their own workspace — a page in this list may still draw less for
 * a member (the settings tabs, a member's /companies shows only their mutes).
 * A path that is in neither list is treated as admin-only, so a route nobody
 * classified fails closed; the route smoke fails the build on one.
 */

export type RouteAccess = 'open' | 'personal' | 'admin';

/** Answered without a person (web/current-user.ts:isUserless). */
const OPEN_ROUTES = ['GET /health', 'GET /auth/*', 'POST /auth/*', 'GET /static/*'] as const;

export const PERSONAL_ROUTES = [
  'GET /',
  'GET /countries.json',
  // Facts, comparisons, letters, packs, applications: a person's own rows.
  'POST /facts',
  'POST /facts/delete',
  'POST /jobs/:id/matches/:matchId/keywords',
  'GET /jobs',
  'GET /jobs/new',
  'POST /jobs/new',
  'GET /jobs/:id',
  'POST /jobs/:id/status',
  'POST /jobs/:id/reclassify',
  'POST /jobs/:id/description/refresh',
  'POST /jobs/:id/description',
  'POST /jobs/:id/description/restore',
  'GET /jobs/:id/edit',
  'POST /jobs/:id/edit',
  'POST /jobs/:id/verify',
  'POST /jobs/:id/match',
  'POST /jobs/:id/matches/:matchId/suggestions',
  'POST /jobs/:id/matches/:matchId/condense/:step',
  'POST /jobs/:id/matches/:matchId/actions/:index/rewrite',
  'POST /jobs/:id/cover',
  'GET /jobs/:id/cover/:letterId/file/:fmt',
  'POST /jobs/:id/cover/:letterId',
  'GET /jobs/:id/target',
  'POST /jobs/:id/target/reupload',
  'POST /jobs/:id/pack',
  'POST /jobs/:id/pack/cancel',
  'GET /jobs/:id/pack/state',
  'GET /jobs/:id/pack/resume.docx',
  'GET /jobs/:id/pack/resume.pdf',
  'GET /applications',
  'GET /applications/export.csv',
  'GET /applications/export.md',
  'POST /jobs/:id/stage',
  'POST /jobs/:id/consider',
  'POST /jobs/:id/application',
  'GET /letter',
  'POST /letter',
  'GET /target/runs/:id/state',
  'GET /target/runs/:id',
  // Resumes and what hangs off them.
  'POST /settings/reactive-resume',
  'POST /settings/reactive-resume/remove',
  'GET /resumes',
  'POST /resumes',
  'POST /resumes/reactive/list',
  'POST /resumes/reactive/import',
  'POST /resumes/:id/reactive/list',
  'POST /resumes/:id/replace',
  'POST /resumes/:id/compare-format',
  'GET /resumes/:id',
  'GET /resumes/:id/download',
  'POST /resumes/:id/draft',
  'GET /tailored/:id/download',
  'POST /tailored/:id/delete',
  'POST /tailored/:id/promote',
  'POST /tailored/:id/reactive-send',
  'GET /tailored/:id/reactive-sent',
  'POST /resumes/:id/props',
  'POST /resumes/:id/profile',
  'POST /resumes/:id/rescan',
  'POST /resumes/:id/review',
  'POST /resumes/:id/answers',
  'POST /resumes/:id/rename',
  'POST /resumes/:id/default',
  'POST /resumes/:id/delete',
  'POST /resumes/:id/document',
  'GET /resumes/:id/render',
  'POST /resumes/:id/render/shape',
  'POST /resumes/:id/render',
  // The mute list lives on /companies; the rest of that page is the install's.
  'GET /companies',
  'POST /companies/mutes',
  'POST /companies/mutes/delete',
  // What the install ran: read-only for a member (install runs, the funnel, their own recaps).
  'GET /runs',
  'GET /runs/running',
  'GET /runs/fetch-now/:id/state',
  'GET /runs/fetch-now/:id',
  'GET /runs/:id',
  'GET /runs/:id/card',
  // The person's own settings; the page hides the install-wide sections from a member.
  'GET /settings',
  'POST /settings/schedule',
  'POST /settings/telegram-toggle',
  'POST /settings/application-tracking-toggle',
  'POST /settings/stages/add',
  'POST /settings/stages/:key/remove',
  'POST /settings/stages/:key/move',
  'POST /settings/stages/:key/rename',
  'POST /settings/locale',
  'POST /settings/theme',
  'POST /settings/pack',
  'POST /settings/reapply',
  'POST /settings/stale-digest-toggle',
  'POST /settings/targets',
  'POST /settings/targets/:id/toggle',
  'POST /settings/targets/:id/delete',
  'POST /settings/targets/:id/test',
  'POST /settings/profiles/new',
  'POST /settings/profiles/active',
  'POST /settings/profiles/activate',
  'POST /settings/profiles/delete',
  'POST /settings/profiles/:id/save',
  'POST /settings/profiles/:id/fill-from-resume',
  // Their own Gmail job leads (ADR 0071): connect, label, a check, disconnect.
  'GET /gmail/connect',
  'GET /gmail/callback',
  'POST /gmail/label',
  'POST /gmail/check',
  'POST /gmail/disconnect',
] as const;

export const ADMIN_ROUTES = [
  // The first-run wizard sets up the install's engines and sources.
  'GET /welcome',
  'POST /welcome/*',
  // Sources, companies, watchlist, folders, discovery, imports, starter packs.
  'POST /companies/suggested',
  'POST /companies/suggested/all',
  'POST /companies/starter-pack',
  'POST /companies/starter-pack/import',
  'POST /companies/starter-pack/enable',
  'POST /companies/new',
  'POST /companies/:id/toggle-active',
  'POST /companies/:id/reprobe',
  'POST /companies/:id/delete',
  'POST /companies/:id/watch',
  'POST /companies/:id/check-now',
  'POST /companies/:id/unwatch',
  'POST /companies/:id/paste',
  'POST /companies/watchlist',
  'GET /companies/watchlist/:id/state',
  'GET /companies/watchlist/:id',
  'POST /companies/watchlist/add',
  'POST /companies/folder/check',
  'POST /companies/folder/inbox',
  'POST /companies/folder',
  'GET /companies/:id/files',
  'POST /companies/:id/files/reread',
  'GET /discovery',
  'POST /discovery/toggle',
  'POST /discovery/hn-parser-toggle',
  'POST /discovery/hn-run',
  'POST /discovery/:id/promote',
  'POST /discovery/:id/ignore',
  'POST /discovery/:id/delete',
  'POST /discovery/probe-now',
  'GET /jobs/import',
  'POST /jobs/import',
  'GET /jobs/import/:token',
  'POST /jobs/import/:token/mapping',
  'POST /jobs/import/:token',
  'POST /jobs/import/sources/:id/delete',
  // Fetching, the AI engine and its spend, employer mode, updates.
  'POST /runs/fetch-now',
  'GET /ai',
  'POST /settings/fetching-toggle',
  'POST /settings/ai/*',
  'POST /settings/login-item',
  'POST /settings/sources',
  'POST /settings/sources/key',
  'POST /settings/classifier-mode',
  'POST /settings/update-check-toggle',
  'POST /settings/employer-mode-toggle',
  'POST /settings/screening-retention',
  'POST /settings/source-health-toggle',
  // Employer mode (screenings) is not scoped by person: administrators only (ADR 0070).
  'GET /screen',
  'GET /screen/*',
  'POST /screen',
  'POST /screen/*',
  // The people.
  'GET /users',
  'POST /users/:id/role',
  'POST /users/:id/delete',
] as const;

interface Entry {
  method: string;
  segments: string[];
  access: RouteAccess;
}

function entry(spec: string, access: RouteAccess): Entry {
  const [method, path] = spec.split(' ');
  return { method: method ?? '', segments: (path ?? '').split('/').filter(Boolean), access };
}

const ENTRIES: readonly Entry[] = [
  ...OPEN_ROUTES.map((s) => entry(s, 'open')),
  ...PERSONAL_ROUTES.map((s) => entry(s, 'personal')),
  ...ADMIN_ROUTES.map((s) => entry(s, 'admin')),
];

/** Literal segments matched, or -1 when the pattern does not fit the path. */
function fit(pattern: string[], path: string[]): number {
  let literals = 0;
  for (let i = 0; i < pattern.length; i += 1) {
    const want = pattern[i] as string;
    if (want === '*') return i <= path.length ? literals : -1;
    if (i >= path.length) return -1;
    if (want.startsWith(':')) continue;
    if (want !== path[i]) return -1;
    literals += 1;
  }
  return pattern.length === path.length ? literals : -1;
}

/** The access a request needs. The most specific pattern wins; an unlisted route is admin-only. */
export function routeAccess(method: string, path: string): RouteAccess {
  const verb = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase();
  const segments = path.split('/').filter(Boolean);
  let best: { literals: number; access: RouteAccess } | null = null;
  for (const e of ENTRIES) {
    if (e.method !== verb) continue;
    const literals = fit(e.segments, segments);
    if (literals < 0) continue;
    if (!best || literals > best.literals) best = { literals, access: e.access };
  }
  return best?.access ?? 'admin';
}

const shape = (segments: string[]): string[] => segments.map((s) => (s.startsWith(':') ? ':' : s));

/**
 * Which lists name a registered pattern (as Hono reports it, `:id` params and all).
 * Exactly one is right: none is a route nobody classified, two is a contradiction.
 */
export function classesOf(method: string, pattern: string): RouteAccess[] {
  const verb = method.toUpperCase();
  const own = shape(pattern.split('/').filter(Boolean));
  const found = new Set<RouteAccess>();
  for (const e of ENTRIES) {
    if (e.method !== verb) continue;
    const want = shape(e.segments);
    const wild = want[want.length - 1] === '*';
    const head = wild ? want.slice(0, -1) : want;
    const fits = wild
      ? own.length >= head.length && head.every((s, i) => s === own[i])
      : want.length === own.length && want.every((s, i) => s === own[i]);
    if (fits) found.add(e.access);
  }
  return [...found];
}

export function isAdmin(user: Pick<CurrentUser, 'role'>): boolean {
  return user.role === 'ADMIN';
}

/** Whether this user may make the request at all. */
export function mayRequest(user: Pick<CurrentUser, 'role'>, method: string, path: string): boolean {
  return routeAccess(method, path) !== 'admin' || isAdmin(user);
}
