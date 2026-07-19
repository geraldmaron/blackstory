/**
 * Unit tests for decennial county census → statistics model mappers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CENSUS_COUNTY_BLACK_POPULATION_SERIES_ID,
  CENSUS_COUNTY_TOTAL_POPULATION_SERIES_ID,
  censusCountyDecadeToObservations,
  nationalBlackGrowthFromDecades,
} from './census-county-decade.js';

test('censusCountyDecadeToObservations maps county decade docs to observed stats without MOE', () => {
  const observations = censusCountyDecadeToObservations({
    fips5: '06037',
    decade: '2020',
    totalPopulation: 10_000_000,
    blackPopulation: 800_000,
    source: 'us-census-decennial-2020-pl',
    contentHash: 'a'.repeat(64),
    retrievedAt: '2026-07-18T12:00:00.000Z',
  });

  assert.equal(observations.length, 2);
  const black = observations.find((row) => row.seriesId === CENSUS_COUNTY_BLACK_POPULATION_SERIES_ID);
  const total = observations.find((row) => row.seriesId === CENSUS_COUNTY_TOTAL_POPULATION_SERIES_ID);
  assert.ok(black);
  assert.ok(total);
  assert.equal(black!.estimate, 800_000);
  assert.equal(total!.estimate, 10_000_000);
  assert.equal(black!.boundaryVersion, 'county-2020');
  assert.equal(black!.datasetVintage, '2020 Decennial PL');
  assert.equal(black!.referencePeriod, '2020');
  assert.equal(black!.jurisdictionId, '06037');
  assert.equal(black!.sourceItemId, 'a'.repeat(64));
  assert.equal(black!.status, 'observed');
  assert.equal(black!.marginOfError, undefined);
});

test('censusCountyDecadeToObservations uses SF1 vintage labels for 2000 and 2010', () => {
  const observations = censusCountyDecadeToObservations({
    fips5: '01001',
    decade: '2010',
    totalPopulation: 50_000,
    blackPopulation: 10_000,
    source: 'us-census-decennial-2010-sf1',
    contentHash: 'b'.repeat(64),
    retrievedAt: '2026-07-18T12:00:00.000Z',
  });
  assert.equal(observations[0]!.datasetVintage, '2010 Decennial SF1');
  assert.equal(observations[0]!.boundaryVersion, 'county-2010');
});

test('nationalBlackGrowthFromDecades computes adjacent-decade growth with insufficient MOE significance', () => {
  const records = nationalBlackGrowthFromDecades([
    { decade: '2000', blackPopulation: 34_000_000 },
    { decade: '2010', blackPopulation: 38_000_000 },
    { decade: '2020', blackPopulation: 41_000_000 },
  ]);
  assert.equal(records.length, 2);
  assert.equal(records[0]!.absoluteChange, 4_000_000);
  assert.equal(records[0]!.startObservationId, 'us_2000_black');
  assert.equal(records[0]!.endObservationId, 'us_2010_black');
  assert.deepEqual(records[0]!.significanceResult, {
    method: 'insufficient-margin-of-error-data',
    distinguishable: null,
  });
});
