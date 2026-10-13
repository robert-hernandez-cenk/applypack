import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, currentTheme, parseTheme, themeAttr, withTheme } from './theme';

describe('parseTheme', () => {
  it('keeps the two forced looks', () => {
    assert.equal(parseTheme('light'), 'light');
    assert.equal(parseTheme('dark'), 'dark');
  });

  it('reads anything else as System, so a stale or hand-edited cookie never breaks a page', () => {
    for (const raw of [undefined, null, '', 'system', 'DARK', ' dark', 'blue', 7, {}]) {
      assert.equal(parseTheme(raw), 'system', String(raw));
    }
  });

  it('knows exactly the three looks the switch offers', () => {
    assert.deepEqual([...THEMES], ['system', 'light', 'dark']);
  });
});

describe('themeAttr', () => {
  it('names a forced look and says nothing for System, so the system preference decides', () => {
    assert.equal(themeAttr('dark'), 'dark');
    assert.equal(themeAttr('light'), 'light');
    assert.equal(themeAttr('system'), undefined);
  });
});

describe('the look of the request', () => {
  it('is System outside a request', () => {
    assert.equal(currentTheme(), 'system');
  });

  it('is what the request carried, for the whole of it', async () => {
    await withTheme('dark', async () => {
      await Promise.resolve();
      assert.equal(currentTheme(), 'dark');
    });
    assert.equal(currentTheme(), 'system');
  });
});
