/**
 * Unit tests for operator locate prepare path (mocked Census client — no live network).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SafeHttpClient } from '@repo/domain';
import { prepareLocate } from './locate.js';

const FIXTURE_MATCH = {
  result: {
    addressMatches: [
      {
        matchedAddress: '1518 M ST NW, WASHINGTON, DC, 20005',
        coordinates: { x: -77.03498, y: 38.90559 },
        addressComponents: {},
        geographies: {
          States: [{ STATE: '11', NAME: 'District of Columbia' }],
          Counties: [{ COUNTY: '001', NAME: 'District of Columbia' }],
          'Incorporated Places': [{ PLACE: '50000', NAME: 'Washington' }],
        },
      },
    ],
  },
};

test('prepareLocate returns EntityLocation for a single Census match', async () => {
  const client: SafeHttpClient = async () => ({
    status: 200,
    headers: { 'content-type': 'application/json' },
    bodyText: JSON.stringify(FIXTURE_MATCH),
    finalUrl: 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress',
  });

  const outcome = await prepareLocate(
    {
      entityId: 'ent_metropolitan_ame_001',
      address: '1518 M Street NW, Washington, D.C.',
      jurisdictionLabel: 'Washington, District of Columbia',
      locationPrecision: 'institution',
      stored: { lat: 38.9058, lng: -77.0356 },
      recordedAt: '2026-07-18T00:00:00.000Z',
    },
    { client },
  );

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.decision.action, 'keep');
  assert.equal(outcome.location.entityId, 'ent_metropolitan_ame_001');
  assert.equal(outcome.location.match?.method, 'geocode_census');
  assert.ok(outcome.location.point?.geohash);
});

test('prepareLocate fails closed on empty address', async () => {
  const client: SafeHttpClient = async () => {
    throw new Error('should not fetch');
  };
  const outcome = await prepareLocate(
    { entityId: 'ent_x', address: '   ' },
    { client },
  );
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.reason, 'empty_address');
});
