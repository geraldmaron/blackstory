/**
 * Unit tests for county choropleth level building and GeoJSON join keys.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCountyChoroplethLevels, fips5FromCountyProperties } from './county-choropleth';
import { joinPopulationOntoCountyPolygons } from './join-county-population';
import type { CountyPopulationIndex } from '@repo/domain/map/county-population';

const FIXTURE_INDEX: CountyPopulationIndex = {
  vintages: ['2010', '2020'],
  counties: {
    '17031': {
      '2010': { totalPopulation: 1000, blackPopulation: 200 },
      '2020': { totalPopulation: 1100, blackPopulation: 275 },
    },
    '01001': {
      '2020': { totalPopulation: 58805, blackPopulation: 11496 },
    },
  },
};

test('buildCountyChoroplethLevels buckets Black share for a selected decade', () => {
  const levels = buildCountyChoroplethLevels({
    index: FIXTURE_INDEX,
    mode: 'blackShare',
    decade: '2020',
    fips5List: ['17031', '01001'],
  });
  assert.equal(levels.length, 2);
  const cook = levels.find((level) => level.fips5 === '17031');
  assert.equal(cook?.shareTier, 'high');
  assert.equal(cook?.sharePercent, 25);
});

test('buildCountyChoroplethLevels buckets decade-over-decade share change', () => {
  const levels = buildCountyChoroplethLevels({
    index: FIXTURE_INDEX,
    mode: 'blackChange',
    fromDecade: '2010',
    toDecade: '2020',
    fips5List: ['17031'],
  });
  assert.equal(levels[0]?.changeTier, 'gainStrong');
  assert.equal(levels[0]?.shareDeltaPp, 5);
});

test('fips5FromCountyProperties composes GEOID from state and county FIPS', () => {
  assert.equal(
    fips5FromCountyProperties({ stateFips: '17', countyFips: '031', name: 'Cook' }),
    '17031',
  );
});

test('joinPopulationOntoCountyPolygons copies tiers onto county features', () => {
  const joined = joinPopulationOntoCountyPolygons(
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { stateFips: '17', countyFips: '031', name: 'Cook' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    },
    buildCountyChoroplethLevels({
      index: FIXTURE_INDEX,
      mode: 'blackChange',
      fromDecade: '2010',
      toDecade: '2020',
      fips5List: ['17031'],
    }),
  );
  assert.equal(joined.features[0]?.properties.changeTier, 'gainStrong');
  assert.equal(joined.features[0]?.properties.fips5, '17031');
});
