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

test('strips an evidence/claim parenthetical, keeping the verbatim quote', () => {
  const shipped =
    'Rule in force, 1938. Verbatim: "Usually the protection from adverse influences afforded by ' +
    'these means includes prevention of the infiltration of business and industrial uses, lower ' +
    'class occupancy, and inharmonious racial groups." (evidence ev_fha_1938_para935 / ' +
    'claim_fha1938_para935; public domain).';
  assert.equal(
    stripInternalIds(shipped),
    'Rule in force, 1938. Verbatim: "Usually the protection from adverse influences afforded by ' +
      'these means includes prevention of the infiltration of business and industrial uses, ' +
      'lower class occupancy, and inharmonious racial groups.".',
  );
});

test('strips a mid-sentence evidence parenthetical and keeps the sentence after it', () => {
  const shipped =
    '(evidence ev_shelley_covenant_st_louis / claim_shelley_covenant_stlouis; public domain). ' +
    'Judicial enforcement of such covenants was held unconstitutional in Shelley v. Kraemer (1948).';
  assert.equal(
    stripInternalIds(shipped),
    '. Judicial enforcement of such covenants was held unconstitutional in Shelley v. Kraemer (1948).',
  );
});

test('recognizes an id, a bare id label, and neither', () => {
  assert.equal(containsInternalId('Basis: ent_greenwood_district_001_claim_0.'), true);
  assert.equal(containsInternalId('plantation_arlington_antebellum_home_gardens'), true);
  assert.equal(containsInternalId('Greenwood District'), false);
  assert.equal(containsInternalId(undefined), false);
  assert.equal(containsInternalId('   '), false);
});
