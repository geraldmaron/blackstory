import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from '../testing/load-fixture.js';
import { mapFeatureV1Schema, mapSourceV1Schema } from './map.js';

test('round-trips a valid map source with one feature', () => {
  const fixture = loadFixture<Record<string, unknown>>('map-source.v1.current.json');
  const parsed = mapSourceV1Schema.parse(fixture);
  assert.equal(parsed.features.length, 1);
  assert.deepEqual(parsed, fixture);
});

test('rejects out-of-range GeoJSON coordinates (adversarial: invalid location)', () => {
  const fixture = loadFixture<{ features: unknown[] }>('map-source.v1.current.json');
  const [feature] = fixture.features as { geometry: { type: 'Point'; coordinates: [number, number] } }[];
  const broken = { ...feature, geometry: { type: 'Point' as const, coordinates: [999, 38.9] as [number, number] } };
  assert.throws(() => mapFeatureV1Schema.parse(broken));
});

test('drops server-internal ranking fields (relatedCount/claimCount/raw address) on parse (sensitive-field negative snapshot)', () => {
  const fixture = loadFixture<Record<string, unknown>>('map-feature.v1.sensitive-leak.json');
  const parsed = mapFeatureV1Schema.parse(fixture);
  const properties = parsed.properties as Record<string, unknown>;
  for (const forbiddenKey of ['relatedCount', 'claimCount', 'rawResidentialAddress']) {
    assert.ok(!(forbiddenKey in properties), `${forbiddenKey} must not survive parsing`);
  }
  // The transparency-affordance evidenceCount IS allowed through (see module doc — it's not a
  // ranking signal, just a public claim count), so it should still be present.
  assert.equal(properties.evidenceCount, (fixture as { properties: { evidenceCount: number } }).properties.evidenceCount);
});
