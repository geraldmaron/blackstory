/**
 * Tests for Temporal Gap Discovery decade coverage audit (temporal-gap.v1).
 * Pure functions only — inline fixtures, no I/O beyond the module import.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TEMPORAL_GAP_METHODOLOGY_VERSION,
  TEMPORAL_GAP_METHODOLOGY_DISCLAIMER,
  PROPOSED_OBSCURITY_V2_TEMPORAL_WEIGHT,
  computeDecadeCoverage,
  isDecadeKeyValid,
  rankThinDecades,
} from './temporal-gap-audit.js';

/** Inline fixture: 1920s dominate; 1870s and 1890s are thin. avg = (2+1+24+13)/4 = 10. */
const SAMPLE_COUNTS = {
  '1870': 2,
  '1890': 1,
  '1920': 24,
  '1950': 13,
} as const;

test('computeDecadeCoverage stamps methodology version and disclaimer', () => {
  const report = computeDecadeCoverage(SAMPLE_COUNTS);
  assert.equal(report.methodologyVersion, TEMPORAL_GAP_METHODOLOGY_VERSION);
  assert.equal(report.disclaimerId, TEMPORAL_GAP_METHODOLOGY_DISCLAIMER.id);
  assert.equal(report.totalEntities, 40);
  assert.equal(report.decadeCount, 4);
  assert.equal(report.averageCountPerDecade, 10);
});

test('temporalDensityFactor is T = clip01(1 − count/avg)', () => {
  const report = computeDecadeCoverage(SAMPLE_COUNTS);
  const byDecade = new Map(report.coverage.map((entry) => [entry.decade, entry]));

  // 1890s: 1/10 → T = 0.9
  assert.equal(byDecade.get('1890')?.densityRatio, 0.1);
  assert.equal(byDecade.get('1890')?.temporalDensityFactor, 0.9);
  // 1870s: 2/10 → T = 0.8
  assert.equal(byDecade.get('1870')?.temporalDensityFactor, 0.8);
  // 1920s: 24/10 → above average clips to 0, never negative
  assert.equal(byDecade.get('1920')?.densityRatio, 2.4);
  assert.equal(byDecade.get('1920')?.temporalDensityFactor, 0);
  // 1950s: 13/10 → clips to 0
  assert.equal(byDecade.get('1950')?.temporalDensityFactor, 0);

  for (const entry of report.coverage) {
    assert.ok(entry.temporalDensityFactor >= 0 && entry.temporalDensityFactor <= 1);
    assert.ok(entry.rationale.length > 0);
  }
});

test('coverage output is sorted ascending by decade for deterministic replay', () => {
  const report = computeDecadeCoverage({ '1950': 3, '1870': 1, '1920': 2 });
  assert.deepEqual(
    report.coverage.map((entry) => entry.decade),
    ['1870', '1920', '1950'],
  );
});

test('all-zero catalog slice reports no relative gap signal instead of max thinness', () => {
  const report = computeDecadeCoverage({ '1900': 0, '1910': 0 });
  assert.equal(report.averageCountPerDecade, 0);
  for (const entry of report.coverage) {
    assert.equal(entry.temporalDensityFactor, 0);
    assert.match(entry.rationale, /no relative gap signal/iu);
  }
});

test('computeDecadeCoverage rejects invalid decade keys and counts', () => {
  assert.throws(() => computeDecadeCoverage({}), /at least one decade/u);
  assert.throws(() => computeDecadeCoverage({ '1875': 1 }), /Invalid decade key/u);
  assert.throws(() => computeDecadeCoverage({ '3020': 1 }), /Invalid decade key/u);
  assert.throws(() => computeDecadeCoverage({ '1870': -1 }), /non-negative integer/u);
  assert.throws(() => computeDecadeCoverage({ '1870': 1.5 }), /non-negative integer/u);
});

test('isDecadeKeyValid bounds 1790–2020 decade start years', () => {
  assert.equal(isDecadeKeyValid('1790'), true);
  assert.equal(isDecadeKeyValid('2020'), true);
  assert.equal(isDecadeKeyValid('1780'), false);
  assert.equal(isDecadeKeyValid('2030'), false);
  assert.equal(isDecadeKeyValid('186'), false);
  assert.equal(isDecadeKeyValid('1865'), false);
});

test('rankThinDecades returns thinnest decades first with decade tie-break', () => {
  const report = computeDecadeCoverage(SAMPLE_COUNTS);
  const top2 = rankThinDecades(report, 2);
  assert.deepEqual(
    top2.map((entry) => entry.decade),
    ['1890', '1870'],
  );

  // Tie-break: equal factors rank by ascending decade.
  const tied = computeDecadeCoverage({ '1900': 1, '1870': 1, '1930': 4 });
  const ranked = rankThinDecades(tied, 3);
  assert.deepEqual(
    ranked.map((entry) => entry.decade),
    ['1870', '1900', '1930'],
  );
});

test('rankThinDecades caps at topN and validates topN', () => {
  const report = computeDecadeCoverage(SAMPLE_COUNTS);
  assert.equal(rankThinDecades(report, 10).length, 4);
  assert.equal(rankThinDecades(report, 1).length, 1);
  assert.throws(() => rankThinDecades(report, 0), /positive integer/u);
  assert.throws(() => rankThinDecades(report, 1.5), /positive integer/u);
});

test('proposed obscurity.v2 temporal weight is documented but NOT wired into obscurity.v1', async () => {
  assert.equal(PROPOSED_OBSCURITY_V2_TEMPORAL_WEIGHT, 0.12);
  const obscurity = await import('./obscurity.js');
  // Guard: this bead must not modify obscurity.v1 weights or version.
  assert.equal(obscurity.OBSCURITY_METHODOLOGY_VERSION, 'obscurity.v1');
  assert.equal('temporalDensity' in obscurity.OBSCURITY_WEIGHTS, false);
});
