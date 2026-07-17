/**
 * Pins the pigment scale to its attributed Monk Skin Tone Scale source
 * values, and proves the mono brand mark (which paints in `brandInk`)
 * meets WCAG AA against canvas in both themes — BB-067 acceptance #5.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { darkTheme, lightTheme } from './colors.js';
import { meetsContrast } from './contrast.js';
import { brandInk, pigmentScale } from './pigment.js';

const ATTRIBUTED_MST_4_10_HEX = [
  '#EADABA',
  '#D7BD96',
  '#A07E56',
  '#825C43',
  '#604134',
  '#3A312A',
  '#292420',
] as const;

test('pigment scale matches the attributed Monk 4-10 hex values, in order', () => {
  assert.deepEqual(
    pigmentScale.map((tone) => tone.hex),
    [...ATTRIBUTED_MST_4_10_HEX],
  );
  assert.deepEqual(
    pigmentScale.map((tone) => tone.mstLevel),
    [4, 5, 6, 7, 8, 9, 10],
  );
});

test('pigment scale has no duplicate tones', () => {
  assert.equal(new Set(pigmentScale.map((tone) => tone.hex)).size, pigmentScale.length);
});

test('mono mark ink meets AA on light canvas', () => {
  assert.ok(
    meetsContrast(brandInk.solid, lightTheme.canvas, 'AA'),
    `${brandInk.solid} on ${lightTheme.canvas} fails AA`,
  );
});

test('mono mark inverse ink meets AA on dark canvas', () => {
  assert.ok(
    meetsContrast(brandInk.solidInverse, darkTheme.canvas, 'AA'),
    `${brandInk.solidInverse} on ${darkTheme.canvas} fails AA`,
  );
});
