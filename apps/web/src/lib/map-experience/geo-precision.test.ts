/**
 * Confirms the BB-051 public-precision -> GeoPrecisionTier mapping and the fail-closed
 * display-radius resolution (BB-091 acceptance criterion: no fabricated radius).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geoPrecisionTierForPublicPrecision, resolveDisplayRadiusMeters } from './geo-precision';

test('institution/campus precisions map to the finest tiers', () => {
  assert.equal(geoPrecisionTierForPublicPrecision('institution'), 'exact-site');
  assert.equal(geoPrecisionTierForPublicPrecision('campus'), 'block');
});

test('city/neighborhood precisions map to locality; state/country map to state', () => {
  assert.equal(geoPrecisionTierForPublicPrecision('city'), 'locality');
  assert.equal(geoPrecisionTierForPublicPrecision('neighborhood'), 'locality');
  assert.equal(geoPrecisionTierForPublicPrecision('state'), 'state');
  assert.equal(geoPrecisionTierForPublicPrecision('country'), 'state');
});

test('unclassified precisions fail soft to locality rather than a sharpened tier', () => {
  assert.equal(geoPrecisionTierForPublicPrecision('unknown_future_value'), 'locality');
});

test('exact-site and block tiers always resolve to their fixed radius', () => {
  const site = resolveDisplayRadiusMeters('exact-site');
  const block = resolveDisplayRadiusMeters('block');
  assert.equal(site.ok, true);
  assert.equal(block.ok, true);
  if (site.ok) assert.equal(site.radiusMeters, 30);
  if (block.ok) assert.equal(block.radiusMeters, 200);
});

test('locality tier resolves for D.C. (the one documented state-bbox-as-locality exception)', () => {
  const result = resolveDisplayRadiusMeters('locality', { statePostalCode: 'DC' });
  assert.equal(result.ok, true);
  if (result.ok) assert.ok(result.radiusMeters > 0);
});

test('locality tier fails closed (no fabricated radius) for a state without a resolvable locality bbox', () => {
  const result = resolveDisplayRadiusMeters('locality', { statePostalCode: 'CA' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'jurisdiction_bbox_unresolved');
});

test('state tier resolves via the real US_STATES bbox', () => {
  const result = resolveDisplayRadiusMeters('state', { statePostalCode: 'CA' });
  assert.equal(result.ok, true);
  if (result.ok) assert.ok(result.radiusMeters > 100_000);
});

test('state tier fails closed when the state postal code is unresolvable', () => {
  const result = resolveDisplayRadiusMeters('state', {});
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'state_bbox_unresolved');
});

test('county tier fails closed — no county-bbox reference data is wired yet', () => {
  const result = resolveDisplayRadiusMeters('county', { statePostalCode: 'GA' });
  assert.equal(result.ok, false);
});
