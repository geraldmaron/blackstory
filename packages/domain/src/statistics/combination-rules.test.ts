import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  jurisdictionsAreDisjoint,
  validateSafeSummation,
  combineStandardErrors,
  combineMarginsOfError,
  computeGrowthRecord,
} from './combination-rules.js';
import { asMetricId } from './types.js';
import type { StatisticalObservation } from './types.js';

function observation(overrides: Partial<StatisticalObservation> = {}): StatisticalObservation {
  return {
    seriesId: asMetricId('median-household-income'),
    jurisdictionId: 'us-06-001',
    boundaryVersion: 'tract-2020',
    referencePeriod: '2018-2022',
    datasetVintage: 'ACS 2022 5-Year',
    estimate: 75000,
    marginOfError: 1500,
    standardError: 911,
    sourceItemId: 'src-1',
    retrievedAt: '2026-01-01T00:00:00.000Z',
    status: 'observed',
    ...overrides,
  };
}

test('jurisdictionsAreDisjoint rejects an identical jurisdiction regardless of caller input', () => {
  assert.equal(
    jurisdictionsAreDisjoint('us-06-001', 'us-06-001', { isDisjoint: () => true }),
    false,
  );
});

test('jurisdictionsAreDisjoint defers to a caller-supplied predicate', () => {
  assert.equal(jurisdictionsAreDisjoint('a', 'b', { isDisjoint: () => true }), true);
  assert.equal(jurisdictionsAreDisjoint('a', 'b', { isDisjoint: () => false }), false);
});

test('jurisdictionsAreDisjoint checks a known-disjoint-pairs list order-insensitively', () => {
  const knownDisjointPairs: ReadonlyArray<readonly [string, string]> = [['us-06-001', 'us-06-003']];
  assert.equal(jurisdictionsAreDisjoint('us-06-001', 'us-06-003', { knownDisjointPairs }), true);
  assert.equal(jurisdictionsAreDisjoint('us-06-003', 'us-06-001', { knownDisjointPairs }), true);
  assert.equal(jurisdictionsAreDisjoint('us-06-001', 'us-06-005', { knownDisjointPairs }), false);
});

test('validateSafeSummation accepts two observations from the same series over disjoint, known-vintage-matched geographies', () => {
  const a = observation({ jurisdictionId: 'us-06-001' });
  const b = observation({ jurisdictionId: 'us-06-003' });
  const result = validateSafeSummation(a, b, {
    knownDisjointPairs: [['us-06-001', 'us-06-003']],
  });
  assert.equal(result.safe, true);
  assert.deepEqual(result.reasons, []);
});

test('validateSafeSummation rejects a series/universe mismatch', () => {
  const a = observation({ seriesId: asMetricId('median-household-income') });
  const b = observation({ seriesId: asMetricId('poverty-rate') });
  const result = validateSafeSummation(a, b, { isDisjoint: () => true });
  assert.equal(result.safe, false);
  assert.ok(result.reasons.some((r) => r.includes('series mismatch')));
});

test('validateSafeSummation rejects a boundary version mismatch (the tractVintage-style constraint)', () => {
  const a = observation({ boundaryVersion: 'tract-2020' });
  const b = observation({ boundaryVersion: 'tract-2010' });
  const result = validateSafeSummation(a, b, { isDisjoint: () => true });
  assert.equal(result.safe, false);
  assert.ok(result.reasons.some((r) => r.includes('boundary version mismatch')));
});

test('validateSafeSummation rejects non-disjoint (or unknown-disjointness) geographies', () => {
  const a = observation({ jurisdictionId: 'us-06-001' });
  const b = observation({ jurisdictionId: 'us-06-001' });
  const result = validateSafeSummation(a, b);
  assert.equal(result.safe, false);
  assert.ok(result.reasons.some((r) => r.includes('not known to be disjoint')));
});

test('validateSafeSummation rejects a dataset vintage mismatch and a reference period mismatch, reporting both', () => {
  const a = observation({ datasetVintage: 'ACS 2022 5-Year', referencePeriod: '2018-2022' });
  const b = observation({
    jurisdictionId: 'us-06-003',
    datasetVintage: 'ACS 2021 5-Year',
    referencePeriod: '2017-2021',
  });
  const result = validateSafeSummation(a, b, { isDisjoint: () => true });
  assert.equal(result.safe, false);
  assert.ok(result.reasons.some((r) => r.includes('dataset vintage mismatch')));
  assert.ok(result.reasons.some((r) => r.includes('reference period mismatch')));
});

test('combineStandardErrors matches the known sqrt-sum-of-squares formula', () => {
  // sqrt(3^2 + 4^2) = 5, a well-known Pythagorean triple used to sanity-check the formula.
  assert.equal(combineStandardErrors([3, 4]), 5);
});

test('combineMarginsOfError matches the known sqrt-sum-of-squares formula', () => {
  assert.equal(combineMarginsOfError([1500, 2000]), Math.sqrt(1500 ** 2 + 2000 ** 2));
  assert.equal(combineMarginsOfError([9, 12]), 15);
});

test('combineStandardErrors and combineMarginsOfError reject an empty input', () => {
  assert.throws(() => combineStandardErrors([]));
  assert.throws(() => combineMarginsOfError([]));
});

test('computeGrowthRecord computes absolute and percent change', () => {
  const record = computeGrowthRecord(
    { observationId: 'obs-start', estimate: 100 },
    { observationId: 'obs-end', estimate: 125 },
  );
  assert.equal(record.absoluteChange, 25);
  assert.equal(record.percentChange, 25);
  assert.equal(record.startObservationId, 'obs-start');
  assert.equal(record.endObservationId, 'obs-end');
});

test('computeGrowthRecord returns a null percentChange when the start estimate is zero', () => {
  const record = computeGrowthRecord(
    { observationId: 'obs-start', estimate: 0 },
    { observationId: 'obs-end', estimate: 10 },
  );
  assert.equal(record.percentChange, null);
});

test('computeGrowthRecord marks a change distinguishable when confidence intervals do not overlap', () => {
  const record = computeGrowthRecord(
    { observationId: 'obs-start', estimate: 100, marginOfError: 5 },
    { observationId: 'obs-end', estimate: 200, marginOfError: 5 },
  );
  assert.deepEqual(record.significanceResult, {
    method: 'non-overlapping-confidence-interval',
    distinguishable: true,
    startInterval: [95, 105],
    endInterval: [195, 205],
  });
});

test('computeGrowthRecord marks a change not distinguishable when confidence intervals overlap', () => {
  const record = computeGrowthRecord(
    { observationId: 'obs-start', estimate: 100, marginOfError: 20 },
    { observationId: 'obs-end', estimate: 110, marginOfError: 20 },
  );
  assert.equal(record.significanceResult.method, 'non-overlapping-confidence-interval');
  assert.equal(record.significanceResult.distinguishable, false);
});

test('computeGrowthRecord reports insufficient data when either margin of error is missing', () => {
  const record = computeGrowthRecord(
    { observationId: 'obs-start', estimate: 100 },
    { observationId: 'obs-end', estimate: 110, marginOfError: 5 },
  );
  assert.deepEqual(record.significanceResult, {
    method: 'insufficient-margin-of-error-data',
    distinguishable: null,
  });
});
