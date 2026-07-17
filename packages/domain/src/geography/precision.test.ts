/**
 * Tests for the BB-091 geoPrecision tier vocabulary and precision-radius policy.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FIXED_TIER_RADIUS_METERS,
  GEO_PRECISION_TIERS,
  GEO_PRECISION_TIER_RANK,
  PRECISION_BASES,
  boundingRadiusMeters,
  coarserGeoPrecisionTier,
  displayRadiusMeters,
  isCoarserGeoPrecisionTier,
  isGeoPrecisionTier,
  isPrecisionBasis,
  resolveEntityLocationPrecision,
} from './precision.js';

test('GEO_PRECISION_TIERS is the exact-site|block|locality|county|state vocabulary', () => {
  assert.deepEqual(GEO_PRECISION_TIERS, ['exact-site', 'block', 'locality', 'county', 'state']);
  assert.ok(isGeoPrecisionTier('exact-site'));
  assert.ok(isGeoPrecisionTier('state'));
  assert.ok(!isGeoPrecisionTier('city'));
  assert.ok(!isGeoPrecisionTier(''));
});

test('GEO_PRECISION_TIER_RANK orders finest (0) to coarsest (4)', () => {
  assert.equal(GEO_PRECISION_TIER_RANK['exact-site'], 0);
  assert.equal(GEO_PRECISION_TIER_RANK.block, 1);
  assert.equal(GEO_PRECISION_TIER_RANK.locality, 2);
  assert.equal(GEO_PRECISION_TIER_RANK.county, 3);
  assert.equal(GEO_PRECISION_TIER_RANK.state, 4);
  assert.ok(isCoarserGeoPrecisionTier('state', 'exact-site'));
  assert.ok(!isCoarserGeoPrecisionTier('exact-site', 'state'));
  assert.equal(coarserGeoPrecisionTier('county', 'block'), 'county');
});

test('PRECISION_BASES is the source-documented|geocoded|approximated|redacted-by-rule vocabulary', () => {
  assert.deepEqual(PRECISION_BASES, [
    'source-documented',
    'geocoded',
    'approximated',
    'redacted-by-rule',
  ]);
  assert.ok(isPrecisionBasis('source-documented'));
  assert.ok(isPrecisionBasis('redacted-by-rule'));
  assert.ok(!isPrecisionBasis('unknown'));
});

test('displayRadiusMeters returns fixed radii for exact-site and block', () => {
  assert.equal(displayRadiusMeters({ tier: 'exact-site' }), FIXED_TIER_RADIUS_METERS['exact-site']);
  assert.equal(displayRadiusMeters({ tier: 'block' }), FIXED_TIER_RADIUS_METERS.block);
  // Fixed tiers ignore a bbox even when one is supplied.
  assert.equal(
    displayRadiusMeters({ tier: 'exact-site', jurisdictionBBox: [-90, 30, -80, 40] }),
    FIXED_TIER_RADIUS_METERS['exact-site'],
  );
});

test('displayRadiusMeters fails closed for bbox-derived tiers with no jurisdiction bbox', () => {
  assert.throws(() => displayRadiusMeters({ tier: 'county' }), /requires a jurisdiction bbox/);
  assert.throws(() => displayRadiusMeters({ tier: 'locality' }), /requires a jurisdiction bbox/);
  assert.throws(() => displayRadiusMeters({ tier: 'state' }), /requires a jurisdiction bbox/);
});

test('boundingRadiusMeters is deterministic and grows with bbox size', () => {
  // Rhode Island-scale bbox vs. Texas-scale bbox (approximate).
  const small = boundingRadiusMeters([-71.86, 41.15, -71.12, 42.02]);
  const large = boundingRadiusMeters([-106.65, 25.84, -93.51, 36.5]);
  assert.ok(small > 0);
  assert.ok(large > small);
  // Same bbox always yields the same radius (deterministic, no hidden state).
  assert.equal(boundingRadiusMeters([-71.86, 41.15, -71.12, 42.02]), small);
});

test('displayRadiusMeters derives locality/county/state radii from the jurisdiction bbox', () => {
  const bbox: readonly [number, number, number, number] = [-88.5, 30.1, -84.9, 35.0]; // Alabama
  const expected = boundingRadiusMeters(bbox);
  assert.equal(displayRadiusMeters({ tier: 'county', jurisdictionBBox: bbox }), expected);
  assert.equal(displayRadiusMeters({ tier: 'locality', jurisdictionBBox: bbox }), expected);
  assert.equal(displayRadiusMeters({ tier: 'state', jurisdictionBBox: bbox }), expected);
});

test('resolveEntityLocationPrecision: bulk-loaded records default to best-documented precision', () => {
  // A batch of bulk-loaded historic-site records, none of which trip a redaction rule.
  const bulkBatch = [
    { documentedTier: 'exact-site' as const, documentedBasis: 'source-documented' as const },
    { documentedTier: 'block' as const, documentedBasis: 'geocoded' as const },
    { documentedTier: 'locality' as const, documentedBasis: 'approximated' as const },
  ];

  for (const record of bulkBatch) {
    const resolved = resolveEntityLocationPrecision({
      documentedTier: record.documentedTier,
      documentedBasis: record.documentedBasis,
      redactionRequired: false,
    });
    // Unredacted records keep their documented tier and basis exactly — no silent coarsening.
    assert.equal(resolved.tier, record.documentedTier);
    assert.equal(resolved.basis, record.documentedBasis);
    assert.notEqual(resolved.basis, 'redacted-by-rule');
  }
});

test('resolveEntityLocationPrecision: only rule-triggered records coarsen, and basis becomes redacted-by-rule', () => {
  const resolved = resolveEntityLocationPrecision({
    documentedTier: 'exact-site',
    documentedBasis: 'source-documented',
    redactionRequired: true,
  });
  assert.equal(resolved.basis, 'redacted-by-rule');
  assert.ok(isCoarserGeoPrecisionTier(resolved.tier, 'exact-site'));
});

test('resolveEntityLocationPrecision honors an explicit redactedTier when provided', () => {
  const resolved = resolveEntityLocationPrecision({
    documentedTier: 'exact-site',
    documentedBasis: 'source-documented',
    redactionRequired: true,
    redactedTier: 'county',
  });
  assert.equal(resolved.tier, 'county');
  assert.equal(resolved.basis, 'redacted-by-rule');
});

test('resolveEntityLocationPrecision fails closed on an invalid (finer) redactedTier', () => {
  assert.throws(
    () =>
      resolveEntityLocationPrecision({
        documentedTier: 'county',
        documentedBasis: 'source-documented',
        redactionRequired: true,
        redactedTier: 'exact-site',
      }),
    /must not be finer than/,
  );
});

test('redaction is the exception across a mixed batch: only flagged records coarsen', () => {
  const records = [
    { id: 'a', documentedTier: 'exact-site' as const, documentedBasis: 'source-documented' as const, redactionRequired: false },
    { id: 'b', documentedTier: 'block' as const, documentedBasis: 'geocoded' as const, redactionRequired: false },
    { id: 'c', documentedTier: 'exact-site' as const, documentedBasis: 'source-documented' as const, redactionRequired: true },
  ];

  const resolved = records.map((r) => ({
    id: r.id,
    ...resolveEntityLocationPrecision(r),
  }));

  const untouched = resolved.filter((r) => r.basis !== 'redacted-by-rule');
  const coarsened = resolved.filter((r) => r.basis === 'redacted-by-rule');

  assert.equal(untouched.length, 2);
  assert.equal(coarsened.length, 1);
  assert.equal(coarsened[0]?.id, 'c');
  assert.ok(isCoarserGeoPrecisionTier(coarsened[0]!.tier, 'exact-site'));
});
