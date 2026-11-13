/**
 * Confirms the public-precision -> GeoPrecisionTier mapping and the fail-closed
 * display-radius resolution.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  geoPrecisionTierForPublicPrecision,
  resolveDisplayRadiusMeters,
  precisionInWords,
  precisionsWithMark,
  recordMarkFor,
  zoomForLocationPrecision,
} from './geo-precision';

test('institution/site/address precisions map to the finest geo tier; campus to block', () => {
  assert.equal(geoPrecisionTierForPublicPrecision('institution'), 'exact-site');
  assert.equal(geoPrecisionTierForPublicPrecision('site'), 'exact-site');
  assert.equal(geoPrecisionTierForPublicPrecision('address'), 'exact-site');
  assert.equal(geoPrecisionTierForPublicPrecision('campus'), 'block');
});

test('zoomForLocationPrecision: exact 14, neighborhood 12, city 10, county 8, state 6', () => {
  for (const exact of ['address', 'site', 'institution', 'campus']) {
    assert.equal(zoomForLocationPrecision(exact), 14);
  }
  assert.equal(zoomForLocationPrecision('neighborhood'), 12);
  assert.equal(zoomForLocationPrecision('city'), 10);
  assert.equal(zoomForLocationPrecision('county'), 8);
  assert.equal(zoomForLocationPrecision('state'), 6);
  // Unclassified never sharpens past city.
  assert.equal(zoomForLocationPrecision('unknown_future_value'), 10);
});

test('recordMarkFor: dot for exact or site, ring for neighborhood or city, none for county or state', () => {
  for (const exact of ['address', 'site', 'institution', 'campus']) {
    assert.equal(recordMarkFor(exact), 'dot');
  }
  assert.equal(recordMarkFor('neighborhood'), 'ring');
  assert.equal(recordMarkFor('city'), 'ring');
  assert.equal(recordMarkFor('county'), 'none');
  assert.equal(recordMarkFor('state'), 'none');
  assert.equal(recordMarkFor('country'), 'none');
  // An unknown precision is never drawn as a sharp dot.
  assert.equal(recordMarkFor('unknown_future_value'), 'ring');
  assert.deepEqual(precisionsWithMark('none').sort(), ['country', 'county', 'state']);
});

test('precisionInWords names where the archive can place a record', () => {
  assert.equal(precisionInWords('site'), 'Exact site');
  assert.equal(precisionInWords('city'), 'City-level location');
  assert.equal(precisionInWords('neighborhood'), 'Neighborhood-level location');
  assert.equal(precisionInWords('county'), 'County-level location');
  assert.equal(precisionInWords('state'), 'State-level location');
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
