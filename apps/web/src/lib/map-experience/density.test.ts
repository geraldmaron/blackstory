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

test('a long-tailed catalog keeps every tier populated instead of collapsing into one', () => {
  // The shape the live catalog actually has: a handful of states two orders of magnitude
  // above a long thin tail.
  const counts = [367, 352, 267, 244, 235, 231, 216, 180, 176, 164, 159, 141];
  const tail = [99, 74, 61, 48, 37, 31, 24, 19, 17, 14, 12, 10, 8, 6, 6, 4, 4, 3, 2, 2, 2];
  const levels = buildStateDensityLevels(
    [...counts, ...tail].map((count, index) => ({
      stateFips: String(index).padStart(2, '0'),
      statePostalCode: `S${index}`,
      stateName: `State ${index}`,
      count,
    })),
  );

  const share = (tier: string) => levels.filter((level) => level.tier === tier).length;
  // No tier may hold the whole catalog: that is the failure mode this bucketing exists to avoid.
  for (const tier of ['documented', 'emerging', 'concentrated']) {
    assert.ok(share(tier) > 0, `${tier} is empty`);
    assert.ok(share(tier) < levels.length, `${tier} holds every state`);
  }
  // A state in the thin tail still reads as present, never as absent.
  assert.equal(levels.find((level) => level.count === 2)!.tier, 'documented');
});

test('states with equal counts never split across a tier boundary', () => {
  const counts = [5, 5, 5, 5, 5, 5, 40, 90];
  const levels = buildStateDensityLevels(
    counts.map((count, index) => ({
      stateFips: String(index).padStart(2, '0'),
      statePostalCode: `S${index}`,
      stateName: `State ${index}`,
      count,
    })),
  );

  const tiersForFive = new Set(
    levels.filter((level) => level.count === 5).map((level) => level.tier),
  );
  assert.equal(tiersForFive.size, 1);
});
