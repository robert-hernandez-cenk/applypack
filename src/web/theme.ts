import { AsyncLocalStorage } from 'node:async_hooks';

/*
 * The look a request is answered in. System (the default) leaves the page to
 * the browser's own light/dark preference; Light and Dark force one. The choice
 * is a cookie, not a setting: it is read in the first byte of every page, so
 * the first paint is already the right one, and it belongs to the browser it
 * was made in. System is stored as no cookie at all.
 */

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = 'theme';
/** A year, in seconds: a choice should outlast a browser restart without being a lifetime. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Total: only the two forced looks survive; whatever else a cookie holds is System. */
export function parseTheme(raw: unknown): Theme {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/** The `data-theme` the page carries: a forced look by name, nothing for System. */
export function themeAttr(theme: Theme): 'light' | 'dark' | undefined {
  return theme === 'system' ? undefined : theme;
}

const request = new AsyncLocalStorage<Theme>();

export function withTheme<T>(theme: Theme, fn: () => T): T {
  return request.run(theme, fn);
}

/** Sync, for the layout; outside a request the page leaves the choice to the system. */
export function currentTheme(): Theme {
  return request.getStore() ?? 'system';
}
