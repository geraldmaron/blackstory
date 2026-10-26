/**
 * Keeps colors.ts in step with tokens.css. The contrast tests run against colors.ts, so a value
 * that changes in tokens.css alone ships unchecked: a dark low-confidence badge at 4.29:1 passed
 * this way while colors.ts still held an older palette.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  confidencePalettes,
  mapPalettes,
  statusPalettes,
  themePalettes,
  themes,
  type ThemeName,
} from './index.ts';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

const themeSelectors: Record<ThemeName, string> = {
  light: ":root,\n[data-theme='light'] {",
  dark: "[data-theme='dark'] {",
};

function themeBlock(theme: ThemeName): Map<string, string> {
  const start = css.indexOf(themeSelectors[theme]);
  assert.ok(start >= 0, `tokens.css has no ${theme} theme block`);
  const end = css.indexOf('\n}', start);
  const body = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
  const vars = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/--ds-([\w-]+):\s*([^;]+);/g)) {
    if (name && value) vars.set(name, value.trim().toLowerCase());
  }
  return vars;
}

const kebab = (key: string) => key.replace(/[A-Z0-9]+/g, (part) => `-${part.toLowerCase()}`);

function expectedTokens(theme: ThemeName): ReadonlyArray<readonly [string, string]> {
  const rows: Array<readonly [string, string]> = [];
  for (const [key, value] of Object.entries(themePalettes[theme])) rows.push([kebab(key), value]);
  for (const [role, palette] of Object.entries(statusPalettes[theme])) {
    rows.push([`${role}-fg`, palette.fg], [`${role}-bg`, palette.bg], [`${role}-border`, palette.border]);
  }
  for (const [level, palette] of Object.entries(confidencePalettes[theme])) {
    rows.push(
      [`confidence-${level}-fg`, palette.fg],
      [`confidence-${level}-bg`, palette.bg],
      [`confidence-${level}-border`, palette.border],
    );
  }
  for (const [key, value] of Object.entries(mapPalettes[theme])) rows.push([`map-${kebab(key)}`, value]);
  return rows;
}

for (const theme of themes) {
  test(`${theme} colors.ts matches the tokens.css values that ship`, () => {
    const vars = themeBlock(theme);
    const drift = expectedTokens(theme)
      .filter(([name, value]) => vars.get(name) !== value.toLowerCase())
      .map(([name, value]) => `--ds-${name}: colors.ts ${value}, tokens.css ${vars.get(name)}`);
    assert.deepEqual(drift, [], `${theme} drift:\n${drift.join('\n')}`);
  });
}
