/**
 * Unit tests for county population share/change helpers used by Explore choropleth layers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blackPopulationChange,
  blackSharePercent,
  bucketBlackChangeTier,
  bucketBlackShareTier,
  countyFips5,
  isCensusPopulationDecade,
} from './county-population.js';

test('countyFips5 pads state and county parts', () => {
  assert.equal(countyFips5('17', '31'), '17031');
  assert.equal(countyFips5('1', '1'), '01001');
});

test('blackSharePercent returns undefined when total population is zero', () => {
  assert.equal(blackSharePercent({ totalPopulation: 0, blackPopulation: 0 }), undefined);
});

test('blackSharePercent computes share in percent points', () => {
  assert.equal(blackSharePercent({ totalPopulation: 200, blackPopulation: 50 }), 25);
});

test('blackPopulationChange compares share and count between decades', () => {
  const change = blackPopulationChange(
    { totalPopulation: 1000, blackPopulation: 100 },
    { totalPopulation: 1100, blackPopulation: 165 },
  );
  assert.equal(change.shareDeltaPp, 5);
  assert.equal(change.countDelta, 65);
});

test('bucketBlackShareTier maps share bands without a false-absence bucket', () => {
  assert.equal(bucketBlackShareTier(undefined), 'unknown');
  assert.equal(bucketBlackShareTier(0.5), 'trace');
  assert.equal(bucketBlackShareTier(5), 'low');
  assert.equal(bucketBlackShareTier(15), 'mid');
  assert.equal(bucketBlackShareTier(30), 'high');
  assert.equal(bucketBlackShareTier(55), 'majority');
});

test('bucketBlackChangeTier uses copper/stone bands, not alarm red framing', () => {
  assert.equal(bucketBlackChangeTier(undefined), 'unknown');
  assert.equal(bucketBlackChangeTier(6), 'gainStrong');
  assert.equal(bucketBlackChangeTier(2), 'gainModerate');
  assert.equal(bucketBlackChangeTier(0.2), 'neutral');
  assert.equal(bucketBlackChangeTier(-2), 'lossModerate');
  assert.equal(bucketBlackChangeTier(-6), 'lossStrong');
});

test('isCensusPopulationDecade accepts only decennial vintages on the map', () => {
  assert.equal(isCensusPopulationDecade('2020'), true);
  assert.equal(isCensusPopulationDecade('1990'), false);
});
