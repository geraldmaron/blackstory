/**
 * Tests for USPS city centroid lookup (zipcodes dataset).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupUsCityCentroid } from './city-centroid.js';

test('lookupUsCityCentroid returns a finite centroid for Montgomery, AL', () => {
  const hit = lookupUsCityCentroid('Montgomery', 'AL');
  assert.ok(hit);
  assert.equal(hit!.stateAbbrev, 'AL');
  assert.ok(Number.isFinite(hit!.lat));
  assert.ok(Number.isFinite(hit!.lng));
  assert.ok(hit!.zipCount > 0);
  // Roughly central Alabama
  assert.ok(hit!.lat > 30 && hit!.lat < 35);
  assert.ok(hit!.lng > -90 && hit!.lng < -84);
});

test('lookupUsCityCentroid returns undefined for unknown city', () => {
  assert.equal(lookupUsCityCentroid('DefinitelyNotACityXx', 'AL'), undefined);
});
