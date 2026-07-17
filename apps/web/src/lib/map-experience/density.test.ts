/**
 * Confirms the density-tier bucketing never demotes a present state to a "none" bucket.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildStateDensityLevels } from './density';

test('every state with nonzero presence gets at least the "documented" tier', () => {
  const levels = buildStateDensityLevels([
    { stateFips: '11', statePostalCode: 'DC', stateName: 'District of Columbia', count: 4 },
    { stateFips: '06', statePostalCode: 'CA', stateName: 'California', count: 1 },
  ]);

  assert.equal(levels.length, 2);
  for (const level of levels) {
    assert.ok(['documented', 'emerging', 'concentrated'].includes(level.tier));
  }
});

test('the highest-count state is classified concentrated relative to the observed range', () => {
  const levels = buildStateDensityLevels([
    { stateFips: '11', statePostalCode: 'DC', stateName: 'District of Columbia', count: 10 },
    { stateFips: '06', statePostalCode: 'CA', stateName: 'California', count: 1 },
  ]);
  const dc = levels.find((level) => level.statePostalCode === 'DC');
  assert.equal(dc!.tier, 'concentrated');
});

test('an empty aggregate list produces an empty density list, not a crash', () => {
  assert.deepEqual(buildStateDensityLevels([]), []);
});

test('a single-state aggregate list classifies without divide-by-zero', () => {
  const levels = buildStateDensityLevels([
    { stateFips: '11', statePostalCode: 'DC', stateName: 'District of Columbia', count: 3 },
  ]);
  assert.equal(levels.length, 1);
  assert.equal(levels[0]!.tier, 'documented');
});
