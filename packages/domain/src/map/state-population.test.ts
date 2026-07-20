/**
 * Unit tests for absolute Black-population tier bucketing and state density join helpers
 * used by the home hero decade fills.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BLACK_POPULATION_CONCENTRATED_MIN,
  BLACK_POPULATION_EMERGING_MIN,
  bucketBlackPopulationTier,
  buildStateBlackPopulationDensityLevels,
  latestStatePopulationVintage,
  parseStatePopulationIndexFile,
  readStatePopulation,
  sumStateBlackPopulation,
  type StatePopulationIndex,
} from './state-population.js';

const LOOKUP = [
  { fips: '11', postalCode: 'DC', name: 'District of Columbia', bbox: [-77.12, 38.79, -76.9, 39.0] as const },
  { fips: '13', postalCode: 'GA', name: 'Georgia', bbox: [-85.7, 30.35, -80.8, 35.0] as const },
  { fips: '02', postalCode: 'AK', name: 'Alaska', bbox: [-179.9, 51.0, -129.9, 71.5] as const },
] as const;

const INDEX: StatePopulationIndex = {
  vintages: ['1790', '1870', '2020'],
  states: {
    '11': {
      '1870': { totalPopulation: 131_700, blackPopulation: 43_404 },
      '2020': { totalPopulation: 689_545, blackPopulation: 285_810 },
    },
    '13': {
      '1790': { totalPopulation: 82_548, blackPopulation: 29_662 },
      '1870': { totalPopulation: 1_184_109, blackPopulation: 545_142 },
      '2020': { totalPopulation: 10_711_908, blackPopulation: 3_320_513 },
    },
    // Alaska present only in modern vintages — early decades must stay omitted.
    '02': {
      '2020': { totalPopulation: 733_391, blackPopulation: 21_898 },
    },
  },
};

test('bucketBlackPopulationTier uses absolute global thresholds', () => {
  assert.equal(bucketBlackPopulationTier(0), 'documented');
  assert.equal(bucketBlackPopulationTier(BLACK_POPULATION_EMERGING_MIN - 1), 'documented');
  assert.equal(bucketBlackPopulationTier(BLACK_POPULATION_EMERGING_MIN), 'emerging');
  assert.equal(bucketBlackPopulationTier(BLACK_POPULATION_CONCENTRATED_MIN - 1), 'emerging');
  assert.equal(bucketBlackPopulationTier(BLACK_POPULATION_CONCENTRATED_MIN), 'concentrated');
});

test('parseStatePopulationIndexFile normalizes compact total/black keys', () => {
  const parsed = parseStatePopulationIndexFile({
    vintages: ['1870'],
    states: { '1': { '1870': { total: 100, black: 40 } } },
  });
  assert.deepEqual(parsed.states['01']?.['1870'], {
    totalPopulation: 100,
    blackPopulation: 40,
  });
});

test('readStatePopulation returns undefined for missing state+decade', () => {
  assert.equal(readStatePopulation(INDEX, '02', '1790'), undefined);
  assert.equal(readStatePopulation(undefined, '13', '1870'), undefined);
  assert.equal(readStatePopulation(INDEX, '13', '1870')?.blackPopulation, 545_142);
});

test('buildStateBlackPopulationDensityLevels omits missing rows — never paints zero', () => {
  const levels1790 = buildStateBlackPopulationDensityLevels(INDEX, '1790', LOOKUP);
  assert.deepEqual(
    levels1790.map((level) => level.statePostalCode),
    ['GA'],
  );
  assert.equal(levels1790[0]!.count, 29_662);
  assert.equal(levels1790[0]!.tier, 'documented');

  const levels1870 = buildStateBlackPopulationDensityLevels(INDEX, '1870', LOOKUP);
  assert.deepEqual(
    levels1870.map((level) => level.statePostalCode),
    ['DC', 'GA'],
  );
  assert.equal(levels1870.find((l) => l.statePostalCode === 'DC')!.tier, 'documented');
  assert.equal(levels1870.find((l) => l.statePostalCode === 'GA')!.tier, 'concentrated');

  // Alaska has no 1870 row — must not appear as a zero fill.
  assert.ok(!levels1870.some((level) => level.statePostalCode === 'AK'));
});

test('latestStatePopulationVintage and sumStateBlackPopulation', () => {
  assert.equal(latestStatePopulationVintage(INDEX), '2020');
  assert.equal(sumStateBlackPopulation(INDEX, '2020'), 285_810 + 3_320_513 + 21_898);
  assert.equal(sumStateBlackPopulation(INDEX, '1790'), 29_662);
});
