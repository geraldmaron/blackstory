/**
 * Tests for USPS city centroid lookup (zipcodes dataset) and the curated non-US city
 * centroid table (repo-9rkh, 2026-09-12 OWNER RULING).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupNonUsCityCentroid, lookupUsCityCentroid } from './city-centroid.js';

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

test('lookupUsCityCentroid resolves abbreviated saint/mount/fort prefixes', () => {
  // The dataset spells these out; sources almost always abbreviate them.
  const abbreviated = lookupUsCityCentroid('St. Louis', 'MO');
  const expanded = lookupUsCityCentroid('Saint Louis', 'MO');
  assert.ok(abbreviated, 'St. Louis, MO should resolve');
  assert.deepEqual(abbreviated, expanded);

  assert.ok(lookupUsCityCentroid('St Louis', 'MO'), 'no-period form should resolve too');
  assert.ok(lookupUsCityCentroid('Mt. Vernon', 'NY'), 'Mt. Vernon, NY should resolve');
  assert.ok(lookupUsCityCentroid('Ft. Worth', 'TX'), 'Ft. Worth, TX should resolve');
});

test('expanding a prefix never invents a city that does not exist', () => {
  assert.equal(lookupUsCityCentroid('St. NotARealPlaceXx', 'MO'), undefined);
});

test('lookupUsCityCentroid resolves conversational names for New York City', () => {
  const bare = lookupUsCityCentroid('New York', 'NY');
  assert.ok(bare);
  assert.deepEqual(lookupUsCityCentroid('New York City', 'NY'), bare);
  assert.deepEqual(lookupUsCityCentroid('NYC', 'NY'), bare);
});

test('lookupNonUsCityCentroid resolves a curated Cuban city', () => {
  const hit = lookupNonUsCityCentroid('Cárdenas', 'CU');
  assert.ok(hit);
  assert.equal(hit!.countryCode, 'CU');
  assert.ok(Number.isFinite(hit!.lat));
  assert.ok(Number.isFinite(hit!.lng));
  // Cárdenas sits on Cuba's northern coast, in Matanzas province.
  assert.ok(hit!.lat > 22 && hit!.lat < 24);
  assert.ok(hit!.lng > -82 && hit!.lng < -80);
});

test('lookupNonUsCityCentroid is accent- and case-insensitive', () => {
  const accented = lookupNonUsCityCentroid('Cárdenas', 'CU');
  assert.deepEqual(lookupNonUsCityCentroid('cardenas', 'cu'), accented);
  assert.deepEqual(lookupNonUsCityCentroid('CARDENAS', 'CU'), accented);
});

test('lookupNonUsCityCentroid resolves every documented repo-9rkh birthplace', () => {
  assert.ok(lookupNonUsCityCentroid('Matanzas', 'CU'), 'Matanzas, CU should resolve');
  assert.ok(lookupNonUsCityCentroid('Cienfuegos', 'CU'), 'Cienfuegos, CU should resolve');
});

test('lookupNonUsCityCentroid returns undefined for a city not yet in the table', () => {
  // Honest gap, not an invented pin — Havana has no documented birthplace in this catalog yet.
  assert.equal(lookupNonUsCityCentroid('Havana', 'CU'), undefined);
});

test('lookupNonUsCityCentroid returns undefined for an unrecognized country code', () => {
  assert.equal(lookupNonUsCityCentroid('Cárdenas', 'XX'), undefined);
});

test('lookupNonUsCityCentroid rejects malformed input the same way lookupUsCityCentroid does', () => {
  assert.equal(lookupNonUsCityCentroid('', 'CU'), undefined);
  assert.equal(lookupNonUsCityCentroid('Cárdenas', 'CUB'), undefined);
});
