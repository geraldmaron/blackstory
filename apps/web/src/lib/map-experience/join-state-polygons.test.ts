/**
 * Unit tests for joining presence/density tiers onto US state polygon features.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DENSITY_TIER_FILL, DIGNITY_PALETTE } from './dignity-style';
import { indexDensityFillColors, joinDensityOntoStatePolygons } from './join-state-polygons';

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

  assert.equal(joined.features[0]?.id, '11');
  assert.equal(joined.features[0]?.properties.densityTier, 'concentrated');
  assert.equal(joined.features[0]?.properties.fillColor, DENSITY_TIER_FILL.concentrated);
  assert.equal(joined.features[0]?.properties.count, 4);
  assert.equal(joined.features[1]?.id, '06');
  assert.equal(joined.features[1]?.properties.densityTier, 'none');
  assert.equal(joined.features[1]?.properties.fillColor, DIGNITY_PALETTE.densityUnknownFill);
  assert.equal(joined.features[1]?.properties.count, 0);
});

test('indexDensityFillColors maps FIPS to settled fillColor', () => {
  const joined = joinDensityOntoStatePolygons(
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { fips: '48' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    },
    [
      {
        stateFips: '48',
        statePostalCode: 'TX',
        stateName: 'Texas',
        count: 2,
        tier: 'documented',
      },
    ],
  );
  const index = indexDensityFillColors(joined);
  assert.equal(index.get('48'), DENSITY_TIER_FILL.documented);
});
