import { isIP } from 'node:net';
import { isPrivateHost, isPrivateIp, lookupAddresses, type Resolver } from '../jobs/posting-url';

/*
 * Where a person's Reactive Resume instance is, and who may ask the server to
 * go there (ADR 0073). No request is made here: `parseInstanceUrl` is pure and
 * `reachable` takes its resolver as an argument. The predicates are the ones
 * the posting-URL guard uses; DNS rebinding between the lookup and the
 * connection is not pinned, as there.
 */

const API_PREFIX = '/api/openapi';
const HTTP_SCHEMES = ['http:', 'https:'];

export type InstanceUrlFailure = 'empty' | 'invalid' | 'scheme' | 'credentials';

export function parseInstanceUrl(raw: string): { ok: true; base: URL } | { ok: false; code: InstanceUrlFailure } {
  const typed = raw.trim();
  if (!typed) return { ok: false, code: 'empty' };
  let url: URL;
  try {
    // "rxresu.me" and "192.168.1.5:3000" are what people type; "ftp://…" has a scheme of its own to refuse.
    // A name on the person's own network is almost always plain http, a public one https.
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(typed) ? typed : `${isPrivateHost(new URL(`https://${typed}`).hostname) ? 'http' : 'https'}://${typed}`);
  } catch {
    return { ok: false, code: 'invalid' };
  }
  if (!HTTP_SCHEMES.includes(url.protocol)) return { ok: false, code: 'scheme' };
  if (url.username || url.password) return { ok: false, code: 'credentials' };
  if (!url.hostname) return { ok: false, code: 'invalid' };
  url.search = '';
  url.hash = '';
  // The address of the instance, not of its API: a pasted API base is trimmed back.
  url.pathname = url.pathname.replace(/\/+$/, '').replace(new RegExp(`${API_PREFIX}$`), '');
  return { ok: true, base: url };
}

/** `path` ("/resumes", "/resumes/<id>") under the instance's API, keeping a path prefix the instance sits behind. */
export function apiUrl(base: URL, path: string): string {
  return `${base.origin}${base.pathname.replace(/\/+$/, '')}${API_PREFIX}${path}`;
}

export type Reach = { ok: true } | { ok: false; code: 'privateAddress' | 'noHost' };

/**
 * Whether the server may call this instance for this person. An administrator
 * may call anywhere (the one person of a local install is one) — a self-hosted instance usually
 * lives on the network. A member may not call a private name or address, nor
 * a name that resolves to one.
 */
export async function reachable(base: URL, who: { privileged: boolean }, resolve: Resolver = lookupAddresses): Promise<Reach> {
  if (who.privileged) return { ok: true };
  if (isPrivateHost(base.hostname)) return { ok: false, code: 'privateAddress' };
  const host = base.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(host)) return { ok: true };
  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    return { ok: false, code: 'noHost' };
  }
  if (addresses.length === 0) return { ok: false, code: 'noHost' };
  return addresses.some(isPrivateIp) ? { ok: false, code: 'privateAddress' } : { ok: true };
}
