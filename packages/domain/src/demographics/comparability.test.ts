/** Tests for decennial race-category comparability bands and reusable disclaimer strings. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COMPARABILITY_NOTE_2000_2020,
  DECADE_RACE_CATEGORY_BANDS,
  MODERN_BLACK_ALONE_BANDS,
  getDecadeRaceCategoryBand,
  isModernBlackAloneDecade,
} from './comparability.js';

test('2000–2020 decades share the Black or African American alone label band', () => {
  for (const decade of ['2000', '2010', '2020'] as const) {
    assert.ok(isModernBlackAloneDecade(decade), `${decade}: modern alone band`);
    const entry = getDecadeRaceCategoryBand(decade);
    assert.ok(entry);
    assert.match(entry.raceCategoryLabel, /Black or African American alone/);
  }
});

test('pre-2000 decades are not treated as modern alone-comparable', () => {
  for (const decade of ['1990', '1870', '1840'] as const) {
    assert.equal(isModernBlackAloneDecade(decade), false, `${decade}: historical band`);
  }
});

test('every band documents notes without embedding numeric claims', () => {
  assert.ok(DECADE_RACE_CATEGORY_BANDS.length >= 4);
  for (const band of DECADE_RACE_CATEGORY_BANDS) {
    assert.ok(band.decades.length > 0);
    assert.ok(band.raceCategoryLabel.length > 0);
    assert.ok(band.notes.length > 20);
    assert.doesNotMatch(band.notes, /\b\d{1,3}(,\d{3})+\b/, `${band.band}: no population counts in notes`);
  }
});

test('COMPARABILITY_NOTE_2000_2020 references boundary crosswalk caution', () => {
  assert.match(COMPARABILITY_NOTE_2000_2020, /Black or African American alone/);
  assert.match(COMPARABILITY_NOTE_2000_2020, /crosswalk/i);
});

test('modern alone bands cover exactly three decades', () => {
  assert.equal(MODERN_BLACK_ALONE_BANDS.length, 3);
});
