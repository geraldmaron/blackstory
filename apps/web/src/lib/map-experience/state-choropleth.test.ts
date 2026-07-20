/**
 * Unit tests for state-level population choropleth tier building.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StatePopulationIndex } from '@repo/domain/map/state-population';
import { buildStateChoroplethLevels } from './state-choropleth';
import { joinPopulationOntoStatePolygons } from './join-state-population';

const FIXTURE_INDEX: StatePopulationIndex = {
  vintages: ['1870', '2020'],
  states: {
    '10': {
      '1870': { totalPopulation: 125_015, blackPopulation: 22_794 },
      '2020': { totalPopulation: 989_948, blackPopulation: 205_046 },
    },
    '36': {
      '1870': { totalPopulation: 4_382_759, blackPopulation: 52_081 },
      '2020': { totalPopulation: 20_201_249, blackPopulation: 3_763_977 },
    },
  },
};

test('buildStateChoroplethLevels buckets Black share for a vintage', () => {
  const levels = buildStateChoroplethLevels({
    index: FIXTURE_INDEX,
    mode: 'blackShare',
    decade: '2020',
    stateFipsList: ['10', '36'],
  });
  const delaware = levels.find((level) => level.stateFips === '10');
  const newYork = levels.find((level) => level.stateFips === '36');
  assert.equal(delaware?.shareTier, 'mid');
  assert.equal(newYork?.shareTier, 'mid');
});

test('buildStateChoroplethLevels computes share change between decades', () => {
  const levels = buildStateChoroplethLevels({
    index: FIXTURE_INDEX,
    mode: 'blackChange',
    fromDecade: '1870',
    toDecade: '2020',
    stateFipsList: ['10'],
  });
  assert.equal(levels[0]?.changeTier, 'gainModerate');
});

test('joinPopulationOntoStatePolygons copies shareTier onto state features', () => {
  const levels = buildStateChoroplethLevels({
    index: FIXTURE_INDEX,
    mode: 'blackShare',
    decade: '2020',
    stateFipsList: ['10'],
  });
  const joined = joinPopulationOntoStatePolygons(
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { fips: '10', name: 'Delaware' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    },
    levels,
  );
  assert.equal(joined.features[0]?.properties.shareTier, 'mid');
});
