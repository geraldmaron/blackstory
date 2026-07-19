import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from '../testing/load-fixture.js';
import { entityV1Schema } from './entity.js';

test('round-trips the full current-shape entity fixture (all optional fields populated)', () => {
  const fixture = loadFixture<Record<string, unknown>>('entity.v1.current.json');
  const parsed = entityV1Schema.parse(fixture);
  assert.equal(parsed.id, 'ent_dunbar_school_001');
  assert.equal(parsed.claims.length, 1);
  assert.equal(parsed.statusHistory?.[0]?.status, 'active');
  assert.equal(parsed.sensitivity?.class, 'none', 'sensitivity stays visible per MOB-003 requirement');
  assert.deepEqual(parsed, fixture, 'no field should be added, dropped, or reshaped for a fully-populated current fixture');
});

test('parses the N-1 (legacy/bootstrap-window) fixture — every optional field absent, deprecated relatedIds dropped', () => {
  const fixture = loadFixture<Record<string, unknown>>('entity.v1.legacy.json');
  const parsed = entityV1Schema.parse(fixture);
  assert.equal(parsed.id, 'ent_15th_st_church_001');
  assert.equal(parsed.recordMaturity, 'projection_stub');
  assert.equal(parsed.statusHistory, undefined);
  assert.equal(parsed.notabilityBasis, undefined);
  assert.equal(parsed.sensitivity, undefined);
  assert.equal(parsed.geoAnchor, undefined);
  // `relatedIds` is a real field on the fixture (the pre-migration deprecated shape) but has no
  // counterpart in the v1 contract (superseded by `related`) — it must not survive parsing.
  assert.ok('relatedIds' in fixture, 'sanity check: fixture really does carry the deprecated field');
  assert.ok(!('relatedIds' in parsed), 'deprecated relatedIds must not survive parsing into the v1 contract');
});

test('drops canonical/internal-only fields on parse (sensitive-field negative snapshot)', () => {
  const fixture = loadFixture<Record<string, unknown>>('entity.v1.sensitive-leak.json');
  const parsed = entityV1Schema.parse(fixture);
  assert.equal(parsed.id, 'ent_leak_test_001');
  for (const forbiddenKey of [
    'notabilityScore',
    'relevanceRankingScore',
    'preciseLocation',
    'internalReviewNotes',
    'sourceLineageInternal',
    'draftOnly',
  ]) {
    assert.ok(!(forbiddenKey in parsed), `${forbiddenKey} must not survive parsing`);
  }
});

test('rejects an unknown entity kind (adversarial: unknown enum value)', () => {
  const fixture = loadFixture<Record<string, unknown>>('entity.v1.legacy.json');
  assert.throws(() => entityV1Schema.parse({ ...fixture, kind: 'person' }));
});

test('rejects an out-of-range geoAnchor coordinate (adversarial: invalid location)', () => {
  const fixture = loadFixture<Record<string, unknown>>('entity.v1.current.json');
  assert.throws(() => entityV1Schema.parse({ ...fixture, geoAnchor: { ...(fixture.geoAnchor as object), lat: 999 } }));
});

test('rejects a claims array beyond the bound (adversarial: maliciously large DTO)', () => {
  const fixture = loadFixture<Record<string, unknown>>('entity.v1.legacy.json') as { claims: unknown[] };
  const oneClaim = fixture.claims[0];
  const oversized = { ...fixture, claims: Array.from({ length: 501 }, () => oneClaim) };
  assert.throws(() => entityV1Schema.parse(oversized));
});

test('locationPrecision is closed to the four public tiers — cannot express "address"/"exact" (ADR-021 §3)', () => {
  const fixture = loadFixture<Record<string, unknown>>('entity.v1.legacy.json');
  assert.throws(() => entityV1Schema.parse({ ...fixture, locationPrecision: 'address' }));
  assert.throws(() => entityV1Schema.parse({ ...fixture, locationPrecision: 'exact' }));
});
