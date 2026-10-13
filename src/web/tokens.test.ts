import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DARK_TOKENS, LIGHT_TOKENS, blend, contrast, hex, rootBlock, type Rgb, type TokenName } from './tokens';

const AA = 4.5;
/** Helper and meta text is small and everywhere: it is held a step above AA (2.40.0). */
const HELPER = 5;
/** The pill's tint over the raised surface — `pill-*` in src/web/tailwind.css paints the same share. */
const PILL_TINT = 0.12;
const WHITE: Rgb = [255, 255, 255];
const SURFACES: TokenName[] = ['surface', 'surface-raised', 'surface-overlay', 'surface-selected'];
const TONES: TokenName[] = ['ok', 'warn', 'danger', 'info', 'violet'];
const SETS = { light: LIGHT_TOKENS, dark: DARK_TOKENS } as const;

const passes = (fg: Rgb, bg: Rgb, floor: number, what: string) => {
  const ratio = contrast(fg, bg);
  assert.ok(ratio >= floor, `${what}: ${ratio.toFixed(2)} < ${floor} (${hex(fg)} on ${hex(bg)})`);
};

describe('contrast arithmetic', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    assert.equal(Math.round(contrast([0, 0, 0], WHITE)), 21);
    assert.equal(contrast(LIGHT_TOKENS.ink, LIGHT_TOKENS.ink), 1);
  });

  it('blends a tint over its ground the way bg-tone/10 paints it', () => {
    assert.deepEqual(blend([0, 0, 0], WHITE, 0.1), [230, 230, 230]);
    assert.deepEqual(blend(LIGHT_TOKENS.ok, WHITE, 1), [...LIGHT_TOKENS.ok]);
  });
});

describe('the two token sets', () => {
  it('name the same colours', () => {
    assert.deepEqual(Object.keys(DARK_TOKENS).sort(), Object.keys(LIGHT_TOKENS).sort());
  });

  it('keep the light look as it was: white cards, white text on the filled buttons', () => {
    assert.deepEqual([...LIGHT_TOKENS['surface-raised']], [255, 255, 255]);
    assert.deepEqual([...LIGHT_TOKENS['on-accent']], [255, 255, 255]);
  });

  it('make the dark canvas the darkest surface and let depth read as light', () => {
    const black: Rgb = [0, 0, 0];
    const d = (name: TokenName) => contrast(DARK_TOKENS[name], black);
    assert.ok(d('surface') < d('surface-raised') && d('surface-raised') < d('surface-overlay'));
    assert.ok(d('surface-overlay') < contrast(WHITE, black) / 4, 'the dark look stays dark');
  });
});

for (const [look, T] of Object.entries(SETS)) {
  const raised = T['surface-raised'];

  describe(`${look}: text on surfaces (WCAG 2.1 AA, normal text)`, () => {
    for (const ink of ['ink', 'ink-muted', 'ink-faint', 'accent-strong'] as const) {
      const floor = ink === 'accent-strong' ? AA : HELPER;
      for (const surface of SURFACES) {
        it(`${ink} on ${surface}`, () => passes(T[ink], T[surface], floor, `${ink} on ${surface}`));
      }
    }

    it('the row hover — selected at 50 % over the raised surface — still carries faint text', () => {
      passes(T['ink-faint'], blend(T['surface-selected'], raised, 0.5), HELPER, 'ink-faint on the row hover');
    });
  });

  describe(`${look}: status tones`, () => {
    for (const tone of TONES) {
      it(`${tone}: on the card, on its 12 % pill, on its 5 % flash, on the canvas`, () => {
        passes(T[tone], raised, AA, `${tone} on the card`);
        passes(T[tone], blend(T[tone], raised, PILL_TINT), AA, `${tone} on its pill`);
        passes(T[tone], blend(T[tone], raised, 0.05), AA, `${tone} on its flash`);
        passes(T[tone], T.surface, AA, `${tone} on the canvas`);
      });
    }

    it('an emerald chip reads on every ground it is laid on', () => {
      for (const ground of ['surface', 'surface-raised'] as const) {
        passes(T['accent-strong'], blend(T.accent, T[ground], 0.1), AA, `accent-strong on accent/10 over ${ground}`);
      }
    });

    it('the tones stay apart from each other', () => {
      for (const a of TONES) {
        for (const b of TONES) {
          if (a >= b) continue;
          const [ar, ag, ab] = T[a];
          const [br, bg, bb] = T[b];
          assert.ok(Math.hypot(ar - br, ag - bg, ab - bb) > 40, `${a} and ${b} are too close`);
        }
      }
    });
  });

  describe(`${look}: filled buttons and the focused control`, () => {
    it('the text on a solid button, the AP mark and the warn button', () => {
      for (const fill of ['accent-strong', 'accent-deep', 'warn'] as const) passes(T['on-accent'], T[fill], AA, `on-accent on ${fill}`);
      passes(T['on-accent'], T.accent, 3, 'on-accent on the AP mark (large bold text)');
    });

    it('the focused control border is a 3:1 indicator against the control and the page', () => {
      passes(T['accent-strong'], raised, 3, 'focus border on the card');
      passes(T['accent-strong'], T.surface, 3, 'focus border on the canvas');
    });

    it('a rule between two surfaces can be seen', () => {
      passes(T['line-strong'], raised, 1.5, 'line-strong on the card');
      passes(T.line, T.surface, 1.1, 'line on the canvas');
    });
  });
}

describe('the :root blocks', () => {
  const css = rootBlock();
  const count = (needle: string) => css.split(needle).length - 1;

  it('declares every token as an RGB triplet in the light set, the forced dark set and the system dark set', () => {
    for (const [name, [r, g, b]] of Object.entries(LIGHT_TOKENS)) {
      assert.equal(count(`--${name}: ${r} ${g} ${b};`), 1, `light ${name}`);
    }
    for (const [name, [r, g, b]] of Object.entries(DARK_TOKENS)) {
      assert.equal(count(`--${name}: ${r} ${g} ${b};`), 2, `dark ${name}`);
    }
  });

  it('puts the light set on :root, the dark one behind data-theme and behind the system preference', () => {
    assert.match(css, /^:root \{\n/);
    assert.match(css, /:root\[data-theme="dark"\] \{/);
    assert.match(css, /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{/);
  });

  it('tells the browser which scheme its own controls should draw', () => {
    assert.equal(count('color-scheme: light;'), 1);
    assert.equal(count('color-scheme: dark;'), 2);
  });

  it('lets the caller add declarations to each set', () => {
    const extra = rootBlock((t) => `--probe: ${t.ink[0]};`);
    assert.equal(extra.split('--probe:').length - 1, 3);
  });

  it('writes a hex for the places a CSS variable cannot reach', () => {
    assert.equal(hex(LIGHT_TOKENS['ink-faint']), '#566173');
    assert.equal(hex(LIGHT_TOKENS.warn), '#A8470A');
    assert.equal(hex(LIGHT_TOKENS.danger), '#B42318');
  });
});
