/**
 * Confirms the BB-051 geo-anchor table stays in sync with the active release and produces valid
 * U.S. coordinates + geohashes.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isWithinUsBounds } from '@black-book/domain';
import { listPublicEntities } from '../../data/public-seed';
import { ENTITY_GEO_ANCHORS, geoAnchorFor } from './entity-geo';

test('every active-release entity has a resolvable geo anchor', () => {
  for (const entity of listPublicEntities()) {
    const anchor = geoAnchorFor(entity.id);
    assert.ok(anchor, `expected a geo anchor for active-release entity ${entity.id}`);
  }
});

test('every anchor is a real point inside the U.S. bounds table', () => {
  for (const [entityId, anchor] of Object.entries(ENTITY_GEO_ANCHORS)) {
    assert.ok(isWithinUsBounds(anchor.lat, anchor.lng), `${entityId} anchor must be within U.S. bounds`);
    assert.equal(anchor.geohash.length, 9);
  }
});

test('returns undefined for an unknown entity id rather than guessing a coordinate', () => {
  assert.equal(geoAnchorFor('ent_does_not_exist'), undefined);
});
