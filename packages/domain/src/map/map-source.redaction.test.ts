/**
 * THE critical BB-070 regression test: proves buildMapSource, wired to the
 * REAL `redactLocationForPublic` from `@black-book/security` (not a stub),
 * never lets a precise living-person residential coordinate reach the
 * generated map source at full precision.
 *
 * `@black-book/security` is a devDependency of this package for this test
 * only (see package.json) — it is never imported by map-source.ts itself,
 * so there is no runtime circular dependency (security already depends on
 * domain at runtime; domain's shipped code has zero dependency on security).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactLocationForPublic } from '@black-book/security';
import { buildMapSource } from './map-source.js';
import {
  DECEASED_RESIDENCE_FIXTURE,
  INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE,
  LIVING_PERSON_RESIDENCE_FIXTURE,
  MAP_SOURCE_DEMO_FIXTURES,
  UNKNOWN_LIVING_STATUS_EXACT_COORDINATES_FIXTURE,
} from './fixtures.js';

const RELEASE_ID = 'rel_redaction_regression';
const GENERATED_AT = '2026-07-17T00:00:00.000Z';

test('CRITICAL: a living person with a precise residential coordinate never appears at full precision', () => {
  const rawLocation = LIVING_PERSON_RESIDENCE_FIXTURE.location;
  assert.ok(rawLocation?.lat !== undefined && rawLocation.lng !== undefined);

  const result = buildMapSource({
    releaseId: RELEASE_ID,
    generatedAt: GENERATED_AT,
    entities: [LIVING_PERSON_RESIDENCE_FIXTURE],
    redactLocation: redactLocationForPublic,
  });

  // The exact raw residential coordinate must not appear anywhere in the
  // serialized output — not truncated float noise, the literal value.
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, new RegExp(String(rawLocation.lat)));
  assert.doesNotMatch(serialized, new RegExp(String(rawLocation.lng)));
  assert.doesNotMatch(serialized, /Bayou Street/); // the address-shaped label

  // The entity still appears (constitution allows city-level presence for a
  // living person's associated place — it is not fully hidden), but only at
  // the constitution's living-residence ceiling: city precision, coarsened
  // to 2 decimal places, with the street-address label stripped.
  const feature = result.featureCollection.features.find(
    (f) => f.id === LIVING_PERSON_RESIDENCE_FIXTURE.entityId,
  );
  assert.ok(feature, 'entity should still appear at reduced precision, not be silently dropped');
  assert.equal(feature.properties.precision, 'city');
  const [lng, lat] = feature.geometry.coordinates;
  assert.equal(lat, 29.76); // Math.round(29.760427 * 100) / 100
  assert.equal(lng, -95.37); // Math.round(-95.369803 * 100) / 100
  assert.notEqual(lat, rawLocation.lat);
  assert.notEqual(lng, rawLocation.lng);
});

test('CRITICAL: unknown living status (default treat-as-living) also never leaks exact coordinates', () => {
  const rawLocation = UNKNOWN_LIVING_STATUS_EXACT_COORDINATES_FIXTURE.location;
  assert.ok(rawLocation?.lat !== undefined && rawLocation.lng !== undefined);

  const result = buildMapSource({
    releaseId: RELEASE_ID,
    generatedAt: GENERATED_AT,
    entities: [UNKNOWN_LIVING_STATUS_EXACT_COORDINATES_FIXTURE],
    redactLocation: redactLocationForPublic,
  });

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, new RegExp(String(rawLocation.lat)));
  assert.doesNotMatch(serialized, new RegExp(String(rawLocation.lng)));

  const feature = result.featureCollection.features[0];
  assert.ok(feature);
  assert.equal(feature.properties.precision, 'city');
});

test('a deceased person historical residence is coarsened, not published raw', () => {
  const rawLocation = DECEASED_RESIDENCE_FIXTURE.location;
  assert.ok(rawLocation?.lat !== undefined && rawLocation.lng !== undefined);

  const result = buildMapSource({
    releaseId: RELEASE_ID,
    generatedAt: GENERATED_AT,
    entities: [DECEASED_RESIDENCE_FIXTURE],
    redactLocation: redactLocationForPublic,
  });

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, new RegExp(String(rawLocation.lat)));
  assert.doesNotMatch(serialized, new RegExp(String(rawLocation.lng)));

  const feature = result.featureCollection.features[0];
  assert.ok(feature);
  assert.equal(feature.properties.precision, 'neighborhood');
});

test('a sensitive site is capped even at an otherwise-allowed source precision', () => {
  const result = buildMapSource({
    releaseId: RELEASE_ID,
    generatedAt: GENERATED_AT,
    entities: [INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE],
    redactLocation: redactLocationForPublic,
  });
  const feature = result.featureCollection.features[0];
  assert.ok(feature);
  // Source precision was 'institution' (allowed) but sensitivityClass caps it.
  assert.equal(feature.properties.precision, 'neighborhood');
});

test('full demo fixture set through the real redaction pipeline: no raw residential coordinate leaks', () => {
  const result = buildMapSource({
    releaseId: RELEASE_ID,
    generatedAt: GENERATED_AT,
    entities: MAP_SOURCE_DEMO_FIXTURES,
    redactLocation: redactLocationForPublic,
  });

  const serialized = JSON.stringify(result);
  for (const entity of MAP_SOURCE_DEMO_FIXTURES) {
    const loc = entity.location;
    if (!loc || loc.lat === undefined || loc.lng === undefined) continue;
    const precisionIsResidential = ['residence', 'street_address', 'unit', 'parcel', 'exact_coordinates'].includes(
      loc.precision,
    );
    if (!precisionIsResidential) continue;
    // Any fixture whose *source* precision was residential-shaped must never
    // contribute its raw coordinate to the output, regardless of livingStatus.
    assert.doesNotMatch(
      serialized,
      new RegExp(String(loc.lat)),
      `raw lat for ${entity.entityId} must not appear in map source`,
    );
    assert.doesNotMatch(
      serialized,
      new RegExp(String(loc.lng)),
      `raw lng for ${entity.entityId} must not appear in map source`,
    );
  }

  // Sanity: the non-residential, non-sensitive fixtures still pass through
  // recognizably (proves this isn't a redactor that hides everything).
  const dcFeature = result.featureCollection.features.find(
    (f) => f.id === 'ent_fixture_place_dc',
  );
  assert.ok(dcFeature);
  assert.equal(dcFeature.properties.precision, 'city');
});
