import { z } from 'zod';
import { fetchWithRetry } from './http';
import { logger } from './logger';
import { getSettings, setLatestRelease } from './settings';
import { parseVersion } from './versions';

/*
 * The optional update check (TASKS N9): one request to GitHub's releases API,
 * weekly from the cleanup job and once when the user turns it on. Off by
 * default — it is the one request ApplyPack makes about itself, and a
 * local-first tool asks before it does that. It never updates anything: an
 * update is `git pull`, which the user should run knowingly.
 */

const RELEASES_URL = 'https://api.github.com/repos/robert-hernandez-cenk/applypack/releases/latest';

const ReleaseSchema = z.object({ tag_name: z.string() });

/** Looks when the switch is on; returns the release it saw, or null (off, unreadable, offline). */
export async function checkForUpdate(now = new Date()): Promise<string | null> {
  if (!(await getSettings()).updateCheck) return null;
  try {
    const resp = await fetchWithRetry(RELEASES_URL, { init: { headers: { Accept: 'application/vnd.github+json' } } });
    const release = ReleaseSchema.safeParse(await resp.json());
    const tag = release.success && parseVersion(release.data.tag_name) ? release.data.tag_name.replace(/^v/, '') : null;
    await setLatestRelease(tag, now);
    logger.info({ latest: tag }, 'update-check: looked');
    return tag;
  } catch (err) {
    logger.warn({ err }, 'update-check: GitHub did not answer');
    return null;
  }
}
