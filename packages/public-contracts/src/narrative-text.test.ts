/**
 * The archive's ids must not reach a reader. These cases are the actual strings that shipped.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { containsInternalId, stripInternalIds } from './narrative-text.js';

test("strips the generator's Basis tail, ids and all", () => {
  const shipped =
    'In effect from 1840, ongoing as of this release. Basis: ' +
    'plantation_arlington_antebellum_home_gardens_q4792278_claim_0, ' +
    'plantation_arlington_antebellum_home_gardens_q4792278_claim_1.';
  assert.equal(stripInternalIds(shipped), 'In effect from 1840.');
});

test('drops a release reference the reader cannot resolve', () => {
  assert.equal(
    stripInternalIds('In effect from 1921, ongoing as of this release.'),
    'In effect from 1921.',
  );
});

test('leaves prose that carries no identifier untouched', () => {
  const body = 'Chartered in 1867 and closed in 1932, after the county withdrew its funding.';
  assert.equal(stripInternalIds(body), body);
});

test('removes a bare id left in the middle of a sentence', () => {
  assert.equal(
    stripInternalIds('Superseded by claim_greenwood_002 in the same release.'),
    'Superseded by in the same release.',
  );
});

test('recognises an id, a bare id label, and neither', () => {
  assert.equal(containsInternalId('Basis: ent_greenwood_district_001_claim_0.'), true);
  assert.equal(containsInternalId('plantation_arlington_antebellum_home_gardens'), true);
  assert.equal(containsInternalId('Greenwood District'), false);
  assert.equal(containsInternalId(undefined), false);
  assert.equal(containsInternalId('   '), false);
});
