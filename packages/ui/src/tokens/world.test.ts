/** The world palette: tokens.css carries what colors.ts says, and its text and marks are legible. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { contrastRatio, worldPalette } from './index.ts';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

test('tokens.css mirrors worldPalette', () => {
  for (const [key, value] of Object.entries(worldPalette)) {
    assert.match(
      css,
      new RegExp(`--ds-world-${kebab(key)}: ${value};`),
      `--ds-world-${kebab(key)}`,
    );
  }
});

test('labels and lights read on the night ground', () => {
  assert.ok(contrastRatio(worldPalette.hudInk, worldPalette.space) >= 7, 'hud ink is AAA on space');
  assert.ok(contrastRatio(worldPalette.ember, worldPalette.space) >= 3, 'ember is a 3:1 mark');
  assert.ok(contrastRatio(worldPalette.rim, worldPalette.space) >= 3, 'rim is a 3:1 graphic');
});
