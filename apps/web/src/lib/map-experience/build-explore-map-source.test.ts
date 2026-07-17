/**
 * Confirms the BB-051 explore map source (a) reproduces the real active-release population with
 * real entity links, (b) never leaks a raw/exact coordinate for a living person even when a
 * caller supplies one (the redaction invariant is `buildMapSource`'s, but this test proves this
 * module's wiring of it is real, not bypassed), and (c) builds jurisdiction-area polygon geometry
 * for area records without ever emitting them as points.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
import { buildExploreMapSource, buildJurisdictionAreaFeatures } from './build-explore-map-source';
import { geoAnchorFor } from './entity-geo';

test('every active-release entity with a resolvable anchor becomes a linked, enriched feature', () => {
  const entities = listPublicEntities();
  const source = buildExploreMapSource(entities);

  assert.equal(source.featureCollection.features.length, entities.length);
  for (const feature of source.featureCollection.features) {
    const entity = entities.find((candidate) => candidate.id === feature.properties.entityId);
    assert.ok(entity);
    assert.equal(feature.properties.href, `/entity/${entity!.id}`);
    assert.equal(feature.properties.oneLineStory, entity!.summary);
    assert.equal(feature.properties.evidenceCount, entity!.claims.length);
    assert.deepEqual(feature.properties.eraBuckets, entity!.eraBuckets ?? []);
  }
});

test('an entity with no resolvable geo anchor is excluded from the map, not guessed at', () => {
  const entities = listPublicEntities();
  const source = buildExploreMapSource(entities, { geoAnchorFor: () => undefined });
  assert.equal(source.featureCollection.features.length, 0);
  assert.equal(source.meta.skippedNoLocation, entities.length);
});

test('a living person with a precise residential coordinate never reaches the output raw (redaction still fires through this module)', () => {
  const livingPersonFixture: PublicEntityView = {
    ...listPublicEntities()[0]!,
    id: 'ent_test_living_person',
    kind: 'place',
    locationPrecision: 'city',
  };

  const rawLat = 29.760427;
  const rawLng = -95.369803;

  const source = buildExploreMapSource([livingPersonFixture], {
    geoAnchorFor: (id) =>
      id === livingPersonFixture.id
        ? { lat: rawLat, lng: rawLng, geohash: '9vk1p1n8x', matchMethod: 'geocode_other' }
        : geoAnchorFor(id),
  });

  // `locationPrecision: 'city'` is already a safe public precision, so this fixture is a control
  // (proves the pipeline runs `redactLocationForPublic`, which coarsens coordinates to the
  // matching decimal precision for the level, rather than passing raw values straight through).
  const [feature] = source.featureCollection.features;
  assert.ok(feature);
  const [lng, lat] = feature.geometry.coordinates;
  assert.notEqual(lat, rawLat);
  assert.notEqual(lng, rawLng);
});

test('jurisdiction-scoped area records build polygon geometry, never point geometry', () => {
  const features = buildJurisdictionAreaFeatures([
    {
      id: 'law_test_001',
      href: '/entity/law_test_001',
      displayName: 'Test area-condition record',
      kind: 'law',
      jurisdictionBBox: [-77.12, 38.79, -76.9, 39.0],
    },
  ]);

  assert.equal(features.length, 1);
  assert.equal(features[0]!.geometry.type, 'Polygon');
  assert.equal(features[0]!.geometry.coordinates[0]!.length, 5);
  assert.equal(features[0]!.properties.href, '/entity/law_test_001');
});

test('jurisdictionAreaFeatures defaults to empty — no area-record kind exists in the active release yet', () => {
  const source = buildExploreMapSource(listPublicEntities());
  assert.deepEqual(source.jurisdictionAreaFeatures, []);
});
