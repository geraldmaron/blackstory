import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chainCpiUrs, toYearDollars } from './cpi.js';
import {
  acsReplicateStandardError,
  bootstrapStandardError,
  clusterBootstrapReplicates,
  moe90,
  seededRandom,
} from './margins.js';
import { livesCellState } from './suppression.js';
import { assignIncomeTier, sizeAdjustedIncome, weightedMedian, weightedShare } from './tiers.js';

test('size adjustment divides by the square root of household size', () => {
  assert.equal(sizeAdjustedIncome(90_000, 1), 90_000);
  assert.equal(sizeAdjustedIncome(90_000, 4), 45_000);
  assert.throws(() => sizeAdjustedIncome(90_000, 0));
  assert.throws(() => sizeAdjustedIncome(Number.NaN, 2));
});

test('tier boundaries at two-thirds and double the median are middle', () => {
  const median = 60_000;
  assert.equal(assignIncomeTier(39_999.99, median), 'lower');
  assert.equal(assignIncomeTier(40_000, median), 'middle');
  assert.equal(assignIncomeTier(120_000, median), 'middle');
  assert.equal(assignIncomeTier(120_000.01, median), 'upper');
  assert.equal(assignIncomeTier(-5_000, median), 'lower');
  assert.throws(() => assignIncomeTier(10, 0));
});

test('weighted median honors weights and ignores weightless rows', () => {
  assert.equal(
    weightedMedian([
      { value: 10, weight: 1 },
      { value: 20, weight: 5 },
      { value: 30, weight: 1 },
    ]),
    20,
  );
  assert.equal(
    weightedMedian([
      { value: 10, weight: 1 },
      { value: 20, weight: 1 },
    ]),
    15,
  );
  assert.equal(
    weightedMedian([
      { value: 1, weight: 0 },
      { value: 50, weight: 2 },
    ]),
    50,
  );
  assert.throws(() => weightedMedian([{ value: 1, weight: 0 }]));
});

test('weighted share reports weighted percentage and unweighted counts', () => {
  const rows = [
    { tier: 'lower', w: 100 },
    { tier: 'lower', w: 300 },
    { tier: 'upper', w: 600 },
    { tier: 'upper', w: 0 },
  ];
  const share = weightedShare(
    rows,
    (row) => row.w,
    (row) => row.tier === 'lower',
  );
  assert.equal(share.sharePct, 40);
  assert.equal(share.unweightedNumerator, 2);
  assert.equal(share.unweightedDenominator, 3);
});

test('CPI chaining rescales CPI-U to CPI-U-RS at the link year', () => {
  const index = chainCpiUrs({
    cpiU: { 1970: 38.8, 1978: 65.2, 1990: 130.7 },
    cpiURs: { 1978: 100, 1990: 176.9 },
  });
  assert.equal(index[1978], 100);
  assert.equal(index[1990], 176.9);
  assert.ok(Math.abs(index[1970]! - (38.8 * 100) / 65.2) < 1e-9);
  assert.equal(toYearDollars(1_000, 1978, 1990, index), 1_769);
  assert.throws(() => toYearDollars(1_000, 1900, 1990, index));
});

test('ACS replicate variance uses the 4/80 successive difference formula', () => {
  const replicates = Array.from({ length: 80 }, (_, i) => (i % 2 === 0 ? 11 : 9));
  assert.equal(acsReplicateStandardError(10, replicates), Math.sqrt((4 / 80) * 80));
  assert.throws(() => acsReplicateStandardError(10, [1, 2, 3]));
});

test('seeded bootstrap is deterministic and resamples whole clusters', () => {
  const households = [[1, 1], [0, 0, 0], [1], [0, 1]];
  const share = (sample: readonly (readonly number[])[]) => {
    const people = sample.flat();
    return (100 * people.filter((p) => p === 1).length) / people.length;
  };
  const a = clusterBootstrapReplicates(households, share, { replicates: 50, seed: 42 });
  const b = clusterBootstrapReplicates(households, share, { replicates: 50, seed: 42 });
  const c = clusterBootstrapReplicates(households, share, { replicates: 50, seed: 7 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(bootstrapStandardError(a) > 0);
  const random = seededRandom(1);
  for (let i = 0; i < 100; i++) {
    const value = random();
    assert.ok(value >= 0 && value < 1);
  }
});

test('shares suppress on n or margin, never on relative error near zero', () => {
  assert.equal(
    livesCellState({ kind: 'share', unweightedN: 49, estimate: 40, standardError: 1 }).state,
    'suppressed',
  );
  assert.equal(
    livesCellState({ kind: 'share', unweightedN: 400, estimate: 0.5, standardError: 0.4 }).state,
    'published',
  );
  assert.equal(
    livesCellState({ kind: 'share', unweightedN: 80, estimate: 40, standardError: 7 }).state,
    'wide_margin',
  );
  assert.equal(
    livesCellState({ kind: 'share', unweightedN: 60, estimate: 40, standardError: 13 }).state,
    'suppressed',
  );
  assert.equal(moe90(10), 16.45);
});

test('levels suppress above 30% relative error and flag from 15%', () => {
  const level = (standardError: number) =>
    livesCellState({ kind: 'level', unweightedN: 500, estimate: 50_000, standardError }).state;
  assert.equal(level(5_000), 'published');
  assert.equal(level(10_000), 'wide_margin');
  assert.equal(level(16_000), 'suppressed');
  assert.equal(
    livesCellState({ kind: 'level', unweightedN: 500, estimate: 0, standardError: 1 }).state,
    'suppressed',
  );
});
