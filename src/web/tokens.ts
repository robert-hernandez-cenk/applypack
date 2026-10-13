/*
 * Design tokens — the light and the dark theme's values, by the semantic names
 * every page styles through (`tailwind.config.js` maps them, `layout.tsx` puts
 * them on `:root`). Pure: `tokens.test.ts` holds each text colour to WCAG AA on
 * every surface it can sit on, in both sets, so a value changed here is
 * checked, not eyeballed. The dark set is a second record of the same shape:
 * `satisfies Record<TokenName, Rgb>` fails the build on a name it lacks.
 */

export type Rgb = readonly [number, number, number];

export const LIGHT_TOKENS = {
  surface: [243, 245, 244], // canvas: page ground, sidebar base
  'surface-raised': [255, 255, 255], // where work happens: cards, tables, controls
  'surface-overlay': [235, 239, 237], // subtle: table header, toolbars, wells, inactive regions
  'surface-selected': [224, 242, 232], // active nav item, selected option, row hover (at 50 %)
  line: [217, 223, 219], // dividers and card outlines
  'line-strong': [188, 198, 192], // control borders
  ink: [13, 20, 33],
  'ink-muted': [61, 72, 89],
  'ink-faint': [86, 97, 115], // 5.4:1 on the selected surface, its hardest ground
  accent: [5, 150, 105], // ring, mark, tints, the chart's line
  'accent-strong': [4, 116, 85], // text, links, primary button
  'accent-deep': [6, 95, 70], // hover
  ok: [4, 116, 85],
  warn: [168, 71, 10],
  danger: [180, 35, 24],
  info: [29, 78, 216],
  violet: [109, 40, 217],
  'on-accent': [255, 255, 255], // text on a solid accent or warn fill
  'shadow-ink': [13, 20, 33], // what every shadow is tinted with
  scrim: [13, 20, 33], // what is laid over the page behind the mobile menu
} as const satisfies Record<string, Rgb>;

export type TokenName = keyof typeof LIGHT_TOKENS;

/*
 * Dark: the canvas is the darkest step and a card one step lighter (depth reads
 * as light, not as shadow); the ink is off-white, never pure; the accent and the
 * status tones are lifted until each clears AA on all four surfaces, so a solid
 * fill carries dark text (`on-accent`) where the light set carries white.
 */
export const DARK_TOKENS = {
  surface: [15, 19, 18],
  'surface-raised': [24, 30, 28],
  'surface-overlay': [33, 41, 38],
  'surface-selected': [21, 55, 43],
  line: [46, 56, 52],
  'line-strong': [78, 91, 85],
  ink: [232, 237, 235],
  'ink-muted': [178, 189, 184],
  'ink-faint': [154, 166, 161],
  accent: [52, 211, 153],
  'accent-strong': [52, 211, 153],
  'accent-deep': [110, 231, 183],
  ok: [52, 211, 153],
  warn: [251, 146, 60],
  danger: [248, 113, 113],
  info: [96, 165, 250],
  violet: [167, 139, 250],
  'on-accent': [4, 30, 22],
  'shadow-ink': [0, 0, 0],
  scrim: [0, 0, 0],
} as const satisfies Record<TokenName, Rgb>;

type TokenSet = Readonly<Record<TokenName, Rgb>>;

const declarations = (tokens: TokenSet, scheme: 'light' | 'dark', extra?: (t: TokenSet) => string): string =>
  [
    ...Object.entries(tokens).map(([name, [r, g, b]]) => `    --${name}: ${r} ${g} ${b};`),
    `    color-scheme: ${scheme};`,
    ...(extra ? [`    ${extra(tokens)}`] : []),
  ].join('\n');

/**
 * The custom properties, consumed as `rgb(var(--name) / alpha)`: the light set
 * on `:root`, the dark set when the page says `data-theme="dark"`, and again
 * when it says nothing and the system prefers dark. `color-scheme` rides with
 * each set so the browser's own controls and scrollbars follow. `extra` adds
 * declarations built from a set (a data-URI cannot read a variable).
 */
export function rootBlock(extra?: (tokens: TokenSet) => string): string {
  return [
    `:root {\n${declarations(LIGHT_TOKENS, 'light', extra)}\n  }`,
    `:root[data-theme="dark"] {\n${declarations(DARK_TOKENS, 'dark', extra)}\n  }`,
    `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${declarations(DARK_TOKENS, 'dark', extra)}\n  }\n  }`,
  ].join('\n  ');
}

/** `#RRGGBB`, for the two places CSS variables cannot reach: a data-URI and a comment. */
export function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** `fg` at `alpha` over `bg` — what a `bg-ok/10` pill really is. */
export function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  const mix = (i: 0 | 1 | 2) => Math.round(alpha * fg[i] + (1 - alpha) * bg[i]);
  return [mix(0), mix(1), mix(2)];
}

function luminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The select's drawn chevron, one per set: a data-URI cannot read a custom property, so the variable holds the whole image. */
export function chevronDeclaration(tokens: Readonly<Record<'ink-faint', Rgb>>): string {
  const stroke = hex(tokens['ink-faint']).slice(1);
  return `--select-chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23${stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");`;
}
