/**
 * Unit tests for joining presence/density tiers onto US state polygon features.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinDensityOntoStatePolygons } from './join-state-polygons';

test('joinDensityOntoStatePolygons copies tier by FIPS and defaults to none', () => {
  const joined = joinDensityOntoStatePolygons(
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: '11',
          properties: { fips: '11', postalCode: 'DC', name: 'District of Columbia' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
        {
          type: 'Feature',
          id: '06',
          properties: { fips: '06', postalCode: 'CA', name: 'California' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    },
    [
      {
        stateFips: '11',
        statePostalCode: 'DC',
        stateName: 'District of Columbia',
        count: 4,
        tier: 'concentrated',
      },
    ],
  );

  assert.equal(joined.features[0]?.properties.densityTier, 'concentrated');
  assert.equal(joined.features[0]?.properties.count, 4);
  assert.equal(joined.features[1]?.properties.densityTier, 'none');
  assert.equal(joined.features[1]?.properties.count, 0);
});
