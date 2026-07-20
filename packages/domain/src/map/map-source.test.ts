/**
 * Pure-logic tests for buildMapSource using a stub redaction port (no
 * @repo/security dependency here; see map-source.redaction.test.ts for
 * the integration regression test against the real redaction functions).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMapSource,
  type MapRedactLocationFn,
  type MapSourceEntityInput,
} from './map-source.js';
import {
  EVENT_NO_LOCATION_FIXTURE,
  INSTITUTION_NYC_NY_FIXTURE,
  MAP_SOURCE_DEMO_FIXTURES,
  PLACE_DC_FIXTURE,
  PLACE_HARLEM_NY_FIXTURE,
  SCHOOL_DC_FIXTURE,
} from './fixtures.js';

/** Pass-through stub: returns the raw location unchanged (precision/lat/lng only). */
const passthroughRedact: MapRedactLocationFn = (input) => {
  if (input.lat === undefined || input.lng === undefined) {
    return { precision: input.precision };
  }
  return { precision: input.precision, lat: input.lat, lng: input.lng, geohash: input.geohash };
};

/** Stub that always returns undefined simulates "nothing safe to publish". */
const alwaysHideRedact: MapRedactLocationFn = () => undefined;

test('buildMapSource skips entities with no location field', () => {
  const result = buildMapSource({
    releaseId: 'rel_test',
    generatedAt: '2026-07-17T00:00:00.000Z',
    entities: [PLACE_DC_FIXTURE, EVENT_NO_LOCATION_FIXTURE],
    redactLocation: passthroughRedact,
  });
  assert.equal(result.meta.totalEntities, 2);
  assert.equal(result.meta.skippedNoLocation, 1);
  assert.equal(result.featureCollection.features.length, 1);
  assert.equal(result.featureCollection.features[0]?.id, PLACE_DC_FIXTURE.entityId);
});

test('buildMapSource never reads lat/lng directly off the raw location', () => {
  // The redact port hides everything; even though raw entities carry real
  // lat/lng, nothing may be emitted because buildMapSource only trusts the
  // port's return value.
  const result = buildMapSource({
    releaseId: 'rel_test',
    generatedAt: '2026-07-17T00:00:00.000Z',
    entities: [PLACE_DC_FIXTURE, SCHOOL_DC_FIXTURE],
    redactLocation: alwaysHideRedact,
  });
  assert.equal(result.featureCollection.features.length, 0);
  assert.equal(result.meta.skippedRedactedToNothing, 2);
});

test('GeoJSON features use [lng, lat] coordinate order', () => {
  const result = buildMapSource({
    releaseId: 'rel_test',
    generatedAt: '2026-07-17T00:00:00.000Z',
    entities: [PLACE_DC_FIXTURE],
    redactLocation: passthroughRedact,
  });
  const feature = result.featureCollection.features[0];
  assert.ok(feature);
  assert.equal(feature.geometry.type, 'Point');
  const [lng, lat] = feature.geometry.coordinates;
  assert.equal(lng, PLACE_DC_FIXTURE.location?.lng);
  assert.equal(lat, PLACE_DC_FIXTURE.location?.lat);
});

test('state aggregates bucket by approximate state and count correctly', () => {
  const result = buildMapSource({
    releaseId: 'rel_test',
    generatedAt: '2026-07-17T00:00:00.000Z',
    entities: [PLACE_DC_FIXTURE, SCHOOL_DC_FIXTURE, PLACE_HARLEM_NY_FIXTURE],
    redactLocation: passthroughRedact,
  });
  const dc = result.stateAggregates.find((s) => s.statePostalCode === 'DC');
  const ny = result.stateAggregates.find((s) => s.statePostalCode === 'NY');
  assert.equal(dc?.count, 2);
  assert.equal(ny?.count, 1);
});

test('county aggregates only populate when an upstream jurisdiction hint is present', () => {
  const result = buildMapSource({
    releaseId: 'rel_test',
    generatedAt: '2026-07-17T00:00:00.000Z',
    entities: [PLACE_HARLEM_NY_FIXTURE, INSTITUTION_NYC_NY_FIXTURE, PLACE_DC_FIXTURE],
    redactLocation: passthroughRedact,
  });
  // PLACE_DC_FIXTURE carries no county hint, so it must not appear in county aggregates.
  assert.equal(result.countyAggregates.length, 1);
  assert.equal(result.countyAggregates[0]?.countyName, 'Queens County');
  assert.equal(result.countyAggregates[0]?.count, 2);
});

test('points outside U.S. bounds are excluded and counted', () => {
  const outsideUs: MapSourceEntityInput = {
    entityId: 'ent_fixture_outside_us',
    kind: 'place',
    displayName: 'Outside U.S. fixture',
    location: { precision: 'city', lat: 48.8566, lng: 2.3522 }, // Paris
  };
  const result = buildMapSource({
    releaseId: 'rel_test',
    generatedAt: '2026-07-17T00:00:00.000Z',
    entities: [outsideUs],
    redactLocation: passthroughRedact,
  });
  assert.equal(result.featureCollection.features.length, 0);
  assert.equal(result.meta.skippedOutsideUsBounds, 1);
});

test('everything-active population: every geo-anchored fixture with a valid precision appears', () => {
  const entitiesWithLocation = MAP_SOURCE_DEMO_FIXTURES.filter((e) => e.location !== undefined);
  const result = buildMapSource({
    releaseId: 'rel_test',
    generatedAt: '2026-07-17T00:00:00.000Z',
    entities: MAP_SOURCE_DEMO_FIXTURES,
    redactLocation: passthroughRedact,
  });
  assert.equal(result.meta.totalWithLocation, entitiesWithLocation.length);
  assert.equal(result.featureCollection.features.length, entitiesWithLocation.length);
  const emittedIds = new Set(result.featureCollection.features.map((f) => f.id));
  for (const entity of entitiesWithLocation) {
    assert.ok(emittedIds.has(entity.entityId), `expected ${entity.entityId} in map source`);
  }
});

test('result is deterministic JSON-serializable output with schemaVersion 1', () => {
  const result = buildMapSource({
    releaseId: 'rel_20260717',
    generatedAt: '2026-07-17T00:00:00.000Z',
    entities: [PLACE_DC_FIXTURE],
    redactLocation: passthroughRedact,
  });
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.releaseId, 'rel_20260717');
  assert.doesNotThrow(() => JSON.stringify(result));
});
