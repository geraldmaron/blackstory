/** The ink ground: tokens.css carries the brand swatches, and its type and marks are legible. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { brandPalette, contrastRatio } from './index.ts';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

const INK_GROUND = {
  '--ds-fixed-ink': brandPalette.blackInk,
  '--ds-fixed-paper': brandPalette.archivePaper,
  '--ds-fixed-accent': brandPalette.copperDark,
  '--ds-material-copper': brandPalette.copperPin,
} as const;

test('the ink ground tokens are brand swatches', () => {
  for (const [name, value] of Object.entries(INK_GROUND)) {
    assert.match(css, new RegExp(`${name}: ${value.toLowerCase()};`), name);
  }
});

test('type and lights read on the ink ground', () => {
  const ground = brandPalette.blackInk;
  assert.ok(contrastRatio(brandPalette.archivePaper, ground) >= 7, 'paper type is AAA on ink');
  assert.ok(contrastRatio(brandPalette.copperDark, ground) >= 3, 'a record light is a 3:1 mark');
  assert.ok(contrastRatio(brandPalette.copperPin, ground) >= 3, 'copper is a 3:1 graphic');
});
