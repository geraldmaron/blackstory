/**
 * Confirms the kind + semantic-tone encoding table: shades trace to DIGNITY_PALETTE,
 * shade+glyph pairs are unique (color never sole signal), contrast holds against the
 * ink basemap except intentionally black plantation (rim carries contrast), and
 * topic-derived tones resolve correctly.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrastRatio } from '@repo/ui';
import { DIGNITY_PALETTE } from './dignity-style';
import {
  DEFAULT_KIND_ENCODING,
  KIND_ENCODING_ENTRIES,
  MAP_KIND_ENCODING,
  MAP_SEMANTIC_TONE_ENCODING,
  displayEncodingFor,
  isKnownMapKind,
  kindEncodingFor,
  mapToneFromTopics,
  type MapEntityGlyph,
  type MapKind,
} from './kind-encoding';

const DOMAIN_KINDS: readonly MapKind[] = [
  'person',
  'place',
  'school',
  'organization',
  'institution',
  'event',
  'law',
  'case',
  'publication',
  'artifact',
  'movement',
  'other',
];

test('the encoding table covers the full domain kind vocabulary', () => {
  assert.deepEqual(Object.keys(MAP_KIND_ENCODING).sort(), [...DOMAIN_KINDS].sort());
});

test('every kind shade passes 3:1 non-text contrast against the ink basemap (except plantation black)', () => {
  for (const [kind, entry] of KIND_ENCODING_ENTRIES) {
    if (kind === 'other' && entry.shade === DIGNITY_PALETTE.kindOther) {
      // stone on ink is intentional secondary; still check
    }
    if (entry.shade === DIGNITY_PALETTE.kindPlantation) continue;
    const ratio = contrastRatio(entry.shade, DIGNITY_PALETTE.background);
    assert.ok(
      ratio >= 3,
      `kind "${kind}" shade ${entry.shade} contrast against basemap ${DIGNITY_PALETTE.background} is ${ratio.toFixed(2)}:1, must be >= 3:1`,
    );
  }
  assert.equal(
    MAP_SEMANTIC_TONE_ENCODING.plantation.shade,
    DIGNITY_PALETTE.kindPlantation,
    'plantation tone stays black; rim (not fill) carries contrast on the dark plate',
  );
});

test('no two kinds share both shade and glyph (color is never the sole signal)', () => {
  const seen = new Set<string>();
  for (const [kind, entry] of KIND_ENCODING_ENTRIES) {
    const signature = `${entry.shade}::${entry.glyph}`;
    assert.ok(!seen.has(signature), `kind "${kind}" duplicates another kind's shade+glyph signature`);
    seen.add(signature);
  }
});

test('every kind has a distinct shade', () => {
  const shades = KIND_ENCODING_ENTRIES.map(([, entry]) => entry.shade);
  assert.equal(new Set(shades).size, shades.length, 'shades must be mutually distinct across kinds');
});

test('every glyph value is one of the four documented glyph identifiers', () => {
  const allowed: readonly MapEntityGlyph[] = ['circle', 'square', 'diamond', 'ring'];
  for (const [, entry] of KIND_ENCODING_ENTRIES) {
    assert.ok(allowed.includes(entry.glyph), `glyph "${entry.glyph}" is not a documented glyph identifier`);
  }
});

test('every shade traces back to a DIGNITY_PALETTE value (zero ad-hoc hex)', () => {
  const allowed = new Set<string>(Object.values(DIGNITY_PALETTE));
  for (const [kind, entry] of KIND_ENCODING_ENTRIES) {
    assert.ok(allowed.has(entry.shade), `kind "${kind}" shade ${entry.shade} must come from DIGNITY_PALETTE`);
  }
});

test('kindEncodingFor resolves known kinds directly and falls back for unknown kinds', () => {
  for (const kind of DOMAIN_KINDS) {
    assert.equal(kindEncodingFor(kind), MAP_KIND_ENCODING[kind]);
    assert.equal(isKnownMapKind(kind), true);
  }
  assert.equal(isKnownMapKind('not-a-kind'), false);
  assert.deepEqual(kindEncodingFor('not-a-kind'), DEFAULT_KIND_ENCODING);
  assert.deepEqual(kindEncodingFor(''), DEFAULT_KIND_ENCODING);
});

test('law is blue copper-family blue and person stays copper', () => {
  assert.equal(MAP_KIND_ENCODING.law.shade, DIGNITY_PALETTE.kindLaw);
  assert.equal(MAP_KIND_ENCODING.person.shade, DIGNITY_PALETTE.kindPerson);
});

test('mapToneFromTopics derives massacre, plantation, and epicenter tones', () => {
  assert.equal(mapToneFromTopics(['Tulsa Race Massacre']), 'massacre');
  assert.equal(mapToneFromTopics(['plantation-economy']), 'plantation');
  assert.equal(mapToneFromTopics(['black-wall-street']), 'epicenter');
  assert.equal(mapToneFromTopics(['schools']), undefined);
});

test('displayEncodingFor prefers semantic tone shade while keeping kind glyph', () => {
  const encoded = displayEncodingFor('place', 'massacre');
  assert.equal(encoded.shade, DIGNITY_PALETTE.kindMassacre);
  assert.equal(encoded.glyph, MAP_KIND_ENCODING.place.glyph);
  assert.equal(encoded.label, MAP_SEMANTIC_TONE_ENCODING.massacre.label);
});

test('kind shades are not red-hued (massacre is a semantic tone, not a kind)', () => {
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
