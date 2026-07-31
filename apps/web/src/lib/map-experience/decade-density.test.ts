/**
 * Density normalisation. The load-bearing case is the sparse decade: the archive's earliest
 * decades carry one or two records each, and a proportional bar would render them invisible
 * against a mid-century peak of several hundred.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DENSITY_FLOOR_PERCENT,
  decadeDensityBars,
  decadeLabel,
  decadeSubLine,
  type DecadeCount,
} from './decade-density';

/** Shaped after the real distribution: single-record early decades, a mid-century peak. */
const SAMPLE: readonly DecadeCount[] = [
  { decade: 1630, count: 1 },
  { decade: 1700, count: 10 },
  { decade: 1800, count: 46 },
  { decade: 1930, count: 340 },
  { decade: 2020, count: 24 },
];

test('a one-record decade and a 340-record decade are both visible', () => {
  const bars = decadeDensityBars(SAMPLE);
  const sparse = bars.find((bar) => bar.decade === 1630);
  const peak = bars.find((bar) => bar.decade === 1930);

  assert.ok(
    sparse && sparse.heightPercent >= DENSITY_FLOOR_PERCENT,
    'the sparse decade clears the floor',
  );
  assert.equal(peak?.heightPercent, 100, 'the peak decade defines the top');
  assert.ok(sparse!.heightPercent < peak!.heightPercent, 'the floor must not flatten the shape');
});

test('the floor is respected by every non-empty decade', () => {
  const bars = decadeDensityBars(SAMPLE);
  for (const bar of bars) {
    assert.ok(
      bar.heightPercent >= DENSITY_FLOOR_PERCENT,
      `${bar.label} at ${bar.heightPercent}% falls below the floor`,
    );
    assert.ok(bar.heightPercent <= 100, `${bar.label} exceeds the track`);
  }
});

test('an empty decade renders nothing rather than being lifted to the floor', () => {
  const bars = decadeDensityBars([
    { decade: 1640, count: 0 },
    { decade: 1650, count: 4 },
  ]);
  assert.equal(bars[0]?.heightPercent, 0, 'zero records must not draw presence');
  assert.ok((bars[1]?.heightPercent ?? 0) >= DENSITY_FLOOR_PERCENT);
});

test('bars come back in chronological order regardless of input order', () => {
  const shuffled: readonly DecadeCount[] = [
    { decade: 1930, count: 340 },
    { decade: 1630, count: 1 },
    { decade: 1800, count: 46 },
  ];
  assert.deepEqual(
    decadeDensityBars(shuffled).map((bar) => bar.decade),
    [1630, 1800, 1930],
  );
});

test('relative heights stay proportional above the floor', () => {
  const bars = decadeDensityBars([
    { decade: 1900, count: 50 },
    { decade: 1910, count: 100 },
  ]);
  const half = bars[0]!.heightPercent - DENSITY_FLOOR_PERCENT;
  const full = bars[1]!.heightPercent - DENSITY_FLOOR_PERCENT;
  assert.ok(Math.abs(half / full - 0.5) < 0.001, 'half the records is half the headroom');
});

test('a single decade renders at full height', () => {
  assert.equal(decadeDensityBars([{ decade: 1960, count: 7 }])[0]?.heightPercent, 100);
});

test('degenerate inputs do not produce NaN', () => {
  assert.deepEqual(decadeDensityBars([]), []);
  const negative = decadeDensityBars([{ decade: 1900, count: -5 }]);
  assert.equal(negative[0]?.count, 0);
  assert.equal(negative[0]?.heightPercent, 0);

  const allZero = decadeDensityBars([
    { decade: 1900, count: 0 },
    { decade: 1910, count: 0 },
  ]);
  for (const bar of allZero) {
    assert.equal(bar.heightPercent, 0);
    assert.ok(Number.isFinite(bar.heightPercent));
  }
});

test('labels read as decades', () => {
  assert.equal(decadeLabel(1960), '1960s');
  assert.equal(decadeDensityBars(SAMPLE)[0]?.label, '1630s');
});

test('the sub-line carries the as-of-decade rule and pluralises', () => {
  const [sparse] = decadeDensityBars([{ decade: 1630, count: 1 }]);
  assert.equal(decadeSubLine(sparse!, 4078), '1 record · status as-of this decade');

  const [many] = decadeDensityBars([{ decade: 1930, count: 340 }]);
  assert.equal(decadeSubLine(many!, 4078), '340 records · status as-of this decade');

  assert.equal(decadeSubLine(null, 4078), '4,078 records');
});

test('sub-line copy carries no em dash', () => {
  const [bar] = decadeDensityBars([{ decade: 1930, count: 340 }]);
  assert.ok(!decadeSubLine(bar!, 4078).includes('—'));
  assert.ok(!decadeSubLine(null, 4078).includes('—'));
});
