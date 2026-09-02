/**
 * Dominant kind-family shade expression for mixed GeoJSON clusters.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIGNITY_PALETTE } from './dignity-style';
import { clusterDominantFamilyShadeExpression } from './cluster-encoding';

test('clusterDominantFamilyShadeExpression is a nested case on family counters', () => {
  const expr = clusterDominantFamilyShadeExpression();
  const serialized = JSON.stringify(expr);
  assert.equal(expr[0], 'case');
  assert.equal(serialized.includes('people_n'), true);
  assert.equal(serialized.includes('sources_n'), true);
  assert.equal(serialized.includes(DIGNITY_PALETTE.point), true);
});
