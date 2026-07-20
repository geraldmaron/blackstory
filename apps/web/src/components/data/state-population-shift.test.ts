/**
 * Unit tests for state population shift diverging bar helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildStateShiftBarRows, divergingBarDomain } from './state-population-shift';
import type { StateChangeLike } from './population-change';

const SAMPLE_CHANGES: readonly StateChangeLike[] = [
  {
    stateFips: '06',
    blackAbsoluteChange: 200_000,
    shareChangePp: 0.2,
    blackPopulationTo: 2_200_000,
  },
  {
    stateFips: '72',
    blackAbsoluteChange: -15_000,
    shareChangePp: -0.4,
    blackPopulationTo: 900_000,
  },
  {
    stateFips: '48',
    blackAbsoluteChange: 500_000,
    shareChangePp: 0.3,
    blackPopulationTo: 3_500_000,
  },
];

test('buildStateShiftBarRows resolves territory names and sorts by absolute change', () => {
  const rows = buildStateShiftBarRows(SAMPLE_CHANGES, {
    '72': 'Puerto Rico',
    '06': 'California',
    '48': 'Texas',
  });
  assert.equal(rows[0]!.stateFips, '48');
  assert.equal(rows.find((row) => row.stateFips === '72')?.stateName, 'Puerto Rico');
});

test('divergingBarDomain returns at least 1 for empty magnitudes', () => {
  assert.deepEqual(divergingBarDomain([]), { maxAbs: 1 });
  assert.equal(
    divergingBarDomain(
      SAMPLE_CHANGES.map((row) => ({
        stateFips: row.stateFips,
        stateName: row.stateFips,
        blackAbsoluteChange: row.blackAbsoluteChange,
        shareChangePp: row.shareChangePp,
      })),
    ).maxAbs,
    500_000,
  );
});
