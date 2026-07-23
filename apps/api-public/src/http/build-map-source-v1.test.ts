/**
 * Unit tests for MapSourceV1 builder (GET /v1/map payload construction).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapSourceV1Schema } from '@repo/public-contracts/v1/map';
import type { EntityV1 } from '@repo/public-contracts/v1/entity';
import { makeEntity } from './entity-fixture.js';
import {
  buildMapSourceV1,
  geoPrecisionTierForPublicPrecision,
  highestConfidence,
} from './build-map-source-v1.js';

test('geoPrecisionTierForPublicPrecision maps public precision vocabulary', () => {
  assert.equal(geoPrecisionTierForPublicPrecision('institution'), 'exact');
  assert.equal(geoPrecisionTierForPublicPrecision('campus'), 'block');
  assert.equal(geoPrecisionTierForPublicPrecision('neighborhood'), 'neighborhood');
  assert.equal(geoPrecisionTierForPublicPrecision('city'), 'city');
  assert.equal(geoPrecisionTierForPublicPrecision('weird'), 'unknown');
});

test('highestConfidence prefers the strongest claim tier', () => {
  assert.equal(highestConfidence([]), 'unrated');
  assert.equal(
    highestConfidence([
      { confidenceLevel: 'low' },
      { confidenceLevel: 'high' },
    ] as EntityV1['claims']),
    'high',
  );
});

test('buildMapSourceV1 skips entities without geoAnchor and validates the contract', () => {
  const withAnchor = makeEntity({
    id: 'ent_with_geo',
    geoAnchor: {
      lat: 38.9072,
      lng: -77.0369,
      geohash: 'dqcjq',
      matchMethod: 'fixture',
    },
  });
  const without = makeEntity({ id: 'ent_no_geo' });
  const source = buildMapSourceV1('rel_test', [withAnchor, without], {
    generatedAt: '2026-07-19T00:00:00.000Z',
  });
  const parsed = mapSourceV1Schema.parse(source);
  assert.equal(parsed.releaseId, 'rel_test');
  assert.equal(parsed.features.length, 1);
  assert.equal(parsed.features[0]!.properties.entityId, 'ent_with_geo');
  assert.equal(parsed.features[0]!.properties.shade.length > 0, true);
  assert.equal(parsed.features[0]!.properties.glyph.length > 0, true);
  // City precision is coarsened by redactLocationForPublic (2 decimal places).
  assert.deepEqual(parsed.features[0]!.geometry.coordinates, [-77.04, 38.91]);
});
