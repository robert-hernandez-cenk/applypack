/*
 * The sign-in settings, read and judged together (ADR 0064). Pure: it takes
 * the environment's values and says what the dashboard should do — stay open
 * as before, sign people in, or refuse to start. A message names the setting
 * and never repeats a value, so a secret cannot reach a log through it.
 */

const SESSION_SECRET_MIN = 32;
const DEFAULT_SESSION_HOURS = 8;
const SESSION_HOURS_MAX = 168;
const SECONDS_PER_HOUR = 3600;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const CALLBACK_PATH = '/auth/callback';

export interface OidcEnv {
  OIDC_ISSUER?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_CLIENT_SECRET?: string;
  OIDC_SESSION_SECRET?: string;
  OIDC_SESSION_HOURS?: string;
  WEB_PUBLIC_URL?: string;
}

export interface OidcSettings {
  issuer: URL;
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  redirectUri: string;
  sessionSeconds: number;
  /** Cookies carry `Secure` when the dashboard is reached over https. */
  secureCookies: boolean;
}

export type OidcReading =
  | { kind: 'off' }
  | { kind: 'on'; settings: OidcSettings }
  | { kind: 'error'; message: string };

function parseUrl(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

function issuerProblem(text: string): string | null {
  const url = parseUrl(text);
  if (!url) return 'OIDC_ISSUER is not a URL';
  if (url.protocol === 'https:') return null;
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return null;
  return 'OIDC_ISSUER must be an https address (http is allowed only for localhost)';
}

function publicUrlProblem(url: URL | null): string | null {
  const isOrigin = url && /^https?:$/.test(url.protocol) && url.hostname && url.pathname === '/' && !url.search && !url.hash;
  return isOrigin ? null : 'WEB_PUBLIC_URL must be the address you open the dashboard at, such as https://jobs.example.com, with no path';
}

function sessionSeconds(hours: string | undefined): number | null {
  if (hours === undefined) return DEFAULT_SESSION_HOURS * SECONDS_PER_HOUR;
  const n = /^\d+$/.test(hours) ? Number(hours) : NaN;
  return n >= 1 && n <= SESSION_HOURS_MAX ? n * SECONDS_PER_HOUR : null;
}

export function readOidcSettings(env: OidcEnv): OidcReading {
  const { OIDC_ISSUER: issuerText, OIDC_CLIENT_ID: clientId, OIDC_CLIENT_SECRET: clientSecret } = env;
  const { OIDC_SESSION_SECRET: sessionSecret, OIDC_SESSION_HOURS: hours, WEB_PUBLIC_URL: publicText } = env;

  if (!issuerText) {
    const stray = Object.entries(env).some(([, value]) => value);
    return stray
      ? { kind: 'error', message: 'OIDC settings are present but OIDC_ISSUER is not set; set it to switch sign-in on, or remove the others' }
      : { kind: 'off' };
  }

  const problems: string[] = [];
  const issueOfIssuer = issuerProblem(issuerText);
  if (issueOfIssuer) problems.push(issueOfIssuer);
  if (!clientId) problems.push('OIDC_CLIENT_ID is not set');
  if (!clientSecret) problems.push('OIDC_CLIENT_SECRET is not set');
  if (!sessionSecret) problems.push('OIDC_SESSION_SECRET is not set');
  else if (sessionSecret.length < SESSION_SECRET_MIN) {
    problems.push(`OIDC_SESSION_SECRET must be at least ${SESSION_SECRET_MIN} characters`);
  }
  const publicUrl = publicText ? parseUrl(publicText) : null;
  if (!publicText) problems.push('WEB_PUBLIC_URL is not set');
  else {
    const issueOfPublic = publicUrlProblem(publicUrl);
    if (issueOfPublic) problems.push(issueOfPublic);
  }
  const seconds = sessionSeconds(hours);
  if (seconds === null) problems.push(`OIDC_SESSION_HOURS must be a whole number from 1 to ${SESSION_HOURS_MAX}`);

  const issuer = parseUrl(issuerText);
  if (problems.length > 0 || !issuer || !clientId || !clientSecret || !sessionSecret || !publicUrl || seconds === null) {
    return { kind: 'error', message: problems.join('; ') };
  }
  return {
    kind: 'on',
    settings: {
      issuer,
      clientId,
      clientSecret,
      sessionSecret,
      redirectUri: `${publicUrl.origin}${CALLBACK_PATH}`,
      sessionSeconds: seconds,
      secureCookies: publicUrl.protocol === 'https:',
    },
  };
}
