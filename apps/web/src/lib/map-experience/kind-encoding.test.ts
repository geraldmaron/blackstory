/**
 * Confirms the BB-099 kind -> shade + glyph table: every shade meets 3:1 non-text contrast
 * against the ink basemap (WCAG 1.4.11 Non-text Contrast the "3:1 against ink basemap" bar the
 * bead sets), every kind carries a distinct glyph AND a distinct shade (no two kinds share both,
 * so color is never the sole signal WCAG 1.4.1), and the fallback entry never crashes on an
 * unknown kind.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrastRatio } from '@blap/ui';
import { DIGNITY_PALETTE } from './dignity-style';
import {
  DEFAULT_KIND_ENCODING,
  KIND_ENCODING_ENTRIES,
  MAP_KIND_ENCODING,
  isKnownMapKind,
  kindEncodingFor,
  type MapEntityGlyph,
} from './kind-encoding';

const LIVE_KINDS = ['place', 'school', 'event', 'institution'] as const;

test('the encoding table covers exactly the live kind vocabulary (place, school, event, institution)', () => {
  assert.deepEqual(Object.keys(MAP_KIND_ENCODING).sort(), [...LIVE_KINDS].sort());
});

test('every kind shade passes 3:1 non-text contrast against the ink basemap', () => {
  for (const [kind, entry] of KIND_ENCODING_ENTRIES) {
    const ratio = contrastRatio(entry.shade, DIGNITY_PALETTE.background);
    assert.ok(
      ratio >= 3,
      `kind "${kind}" shade ${entry.shade} contrast against basemap ${DIGNITY_PALETTE.background} is ${ratio.toFixed(2)}:1, must be >= 3:1`,
    );
  }
});

test('every kind has a distinct glyph', () => {
  const glyphs = KIND_ENCODING_ENTRIES.map(([, entry]) => entry.glyph);
  assert.equal(new Set(glyphs).size, glyphs.length, 'glyphs must be mutually distinct across kinds');
});

test('every kind has a distinct shade', () => {
  const shades = KIND_ENCODING_ENTRIES.map(([, entry]) => entry.shade);
  assert.equal(new Set(shades).size, shades.length, 'shades must be mutually distinct across kinds');
});

test('no two kinds share both shade and glyph (color is never the sole signal)', () => {
  const seen = new Set<string>();
  for (const [kind, entry] of KIND_ENCODING_ENTRIES) {
    const signature = `${entry.shade}::${entry.glyph}`;
    assert.ok(!seen.has(signature), `kind "${kind}" duplicates another kind's shade+glyph signature`);
    seen.add(signature);
  }
});

test('every glyph value is one of the four documented glyph identifiers', () => {
  const allowed: readonly MapEntityGlyph[] = ['circle', 'square', 'diamond', 'ring'];
  for (const [, entry] of KIND_ENCODING_ENTRIES) {
    assert.ok(allowed.includes(entry.glyph), `glyph "${entry.glyph}" is not a documented glyph identifier`);
  }
});

test('every shade traces back to a DIGNITY_PALETTE value (zero ad-hoc hex)', () => {
  const allowed = new Set(Object.values(DIGNITY_PALETTE));
  for (const [kind, entry] of KIND_ENCODING_ENTRIES) {
    assert.ok(allowed.has(entry.shade), `kind "${kind}" shade ${entry.shade} must come from DIGNITY_PALETTE`);
  }
});

test('kindEncodingFor resolves known kinds directly and falls back for unknown kinds', () => {
  for (const kind of LIVE_KINDS) {
    assert.equal(kindEncodingFor(kind), MAP_KIND_ENCODING[kind]);
  }
  assert.equal(isKnownMapKind('law'), false);
  assert.deepEqual(kindEncodingFor('law'), DEFAULT_KIND_ENCODING);
  assert.deepEqual(kindEncodingFor(''), DEFAULT_KIND_ENCODING);
});

test('the dignity rule holds: no kind shade is red-hued', () => {
  // Mirrors dignity-style.test.ts's hue check inline (no violence/crime-heat reading for any
  // per-kind shade either).
  function hue(hex: string): number {
    const normalized = hex.replace('#', '');
    const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
    const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
    const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return 0;
    let h: number;
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    return h < 0 ? h + 360 : h;
  }
  for (const [kind, entry] of KIND_ENCODING_ENTRIES) {
    const h = hue(entry.shade);
    const inRedBand = h < 15 || h > 345;
    assert.ok(!inRedBand, `kind "${kind}" shade ${entry.shade} must not be red-hued`);
  }
});
