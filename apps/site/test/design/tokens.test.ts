import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readDesignTokens } from '../../scripts/design-tokens-lib.mjs';
import * as generated from '../../src/design/generated/tokens';
// The packages/ui token modules the web app tests against; compared here, not imported by the design system.
import {
  confidencePalettes,
  statusPalettes,
  themePalettes,
} from '../../../../packages/ui/src/tokens/colors';
import { contrastRatio } from '../../../../packages/ui/src/tokens/contrast';
import { borders } from '../../../../packages/ui/src/tokens/foundation';
import { grid } from '../../../../packages/ui/src/tokens/spacing';
import { DESIGN_ONLY_ROLES, breakpoints, themes } from '../../src/design/tokens';

test('generated tokens match the shipped CSS (run `npm run design:tokens` if this fails)', () => {
  const { meta, ...fresh } = readDesignTokens();
  for (const [key, value] of Object.entries(fresh)) {
    assert.deepEqual((generated as Record<string, unknown>)[key], value, key);
  }
  assert.equal(generated.sourceSha256, meta.sourceSha256);
  assert.deepEqual(meta.unparsed, [], 'every space, radius and duration token parsed to a number');
});

test('both themes define the same roles', () => {
  assert.deepEqual(Object.keys(themes.dark).sort(), Object.keys(themes.light).sort());
  for (const role of [
    'canvas',
    'surface',
    'surfaceRaised',
    'ink',
    'inkMuted',
    'border',
    'focusRing',
    'accent',
    'warningFg',
    'confidenceHighFg',
    'overlay',
  ]) {
    assert.ok(role in themes.light, role);
  }
});

test('the space scale is the CSS scale on a 4px rhythm', () => {
  assert.deepEqual(generated.space, {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    24: 96,
    32: 128,
    48: 192,
  });
});

test('breakpoints are the grid breakpoints (the set the token lint enforces)', () => {
  assert.deepEqual(breakpoints, { sm: 640, md: 768, lg: 1024, xl: 1280 });
  assert.deepEqual(grid.breakpoints, { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem' });
});

/**
 * packages/ui/src/tokens/colors.ts mirrors tokens.css, and packages/ui's css-parity test holds it there.
 * This list is a ratchet in both directions: a new difference fails the test, and so does fixing one
 * without removing it here. Empty since the confidence palette and surfaces were reconciled to the CSS.
 */
const KNOWN_TS_CSS_DRIFT: readonly string[] = [];

test('colors.ts vs tokens.css: no drift', () => {
  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  const found: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    const css = themes[theme] as Record<string, string>;
    const same = (a: string | undefined, b: string): boolean =>
      a !== undefined &&
      a.toLowerCase().replace(/\s+/g, ' ') === b.toLowerCase().replace(/\s+/g, ' ');
    for (const [role, value] of Object.entries(themePalettes[theme]))
      if (css[role] !== undefined && !same(css[role], value)) found.push(`${theme}.${role}`);
    for (const level of ['high', 'medium', 'low'] as const) {
      for (const part of ['fg', 'bg', 'border'] as const) {
        const key = `confidence${cap(level)}${cap(part)}`;
        if (!same(css[key], confidencePalettes[theme][level][part])) found.push(`${theme}.${key}`);
      }
    }
    for (const role of ['warning', 'dispute', 'error'] as const) {
      for (const part of ['fg', 'bg', 'border'] as const) {
        const key = `${role}${cap(part)}`;
        if (!same(css[key], statusPalettes[theme][role][part])) found.push(`${theme}.${key}`);
      }
    }
  }
  assert.deepEqual(found.sort(), [...KNOWN_TS_CSS_DRIFT].sort());
  assert.equal(borders.radiusMd, `${generated.radius.md}px`);
});

/** Shipped pairs below WCAG AA for body text (4.5:1). The exact list, so a regression fails and a fix must edit it. */
const KNOWN_BELOW_AA: readonly string[] = [];

test('shipped text pairs meet 4.5:1', () => {
  const below: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    const c = themes[theme] as Record<string, string>;
    const pairs: [string, string, string][] = [
      ['ink/canvas', 'ink', 'canvas'],
      ['ink/surface', 'ink', 'surface'],
      ['ink/surfaceRaised', 'ink', 'surfaceRaised'],
      ['inkMuted/canvas', 'inkMuted', 'canvas'],
      ['accent/canvas', 'accent', 'canvas'],
      ['inverseInk/inverse', 'inverseInk', 'inverse'],
    ];
    for (const role of ['warning', 'dispute', 'error'])
      pairs.push([`${role} fg/bg`, `${role}Fg`, `${role}Bg`]);
    for (const level of ['High', 'Medium', 'Low'])
      pairs.push([
        `confidence-${level.toLowerCase()} fg/bg`,
        `confidence${level}Fg`,
        `confidence${level}Bg`,
      ]);
    for (const [label, fg, bg] of pairs) {
      if (contrastRatio(c[fg]!, c[bg]!) < 4.5) below.push(`${theme} ${label}`);
    }
  }
  assert.deepEqual(below, KNOWN_BELOW_AA);
});

test('fixedInk (referenced by the CSS, never defined there) is readable on the copper plate in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const ratio = contrastRatio(
      DESIGN_ONLY_ROLES.fixedInk,
      (themes[theme] as Record<string, string>).accentGraphic!,
    );
    assert.ok(ratio >= 4.5, `${theme} fixedInk on accentGraphic is ${ratio.toFixed(2)}`);
  }
  // What ships when the variable is undefined: the inherited text color on the dark copper plate.
  assert.ok(contrastRatio(themes.dark.ink, themes.dark.accentGraphic) < 4.5);
});
