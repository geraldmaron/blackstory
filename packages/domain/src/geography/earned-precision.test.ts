import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateEarnedPrecision } from './earned-precision.js';

const base = { kind: 'law', precision: 'institution', matchMethod: 'manual_research', claims: [] };

test('a law at institution with no place claim fails the place-claim rule', () => {
  const r = evaluateEarnedPrecision({
    ...base,
    claims: [{ predicate: 'signed_on' }, { predicate: 'held' }],
  });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.rule, 'place_claim');
});

test('a place claim satisfies rule 1; coarser precisions and place kinds are exempt', () => {
  assert.equal(
    evaluateEarnedPrecision({ ...base, claims: [{ predicate: 'documented_site' }] }).ok,
    true,
  );
  assert.equal(evaluateEarnedPrecision({ ...base, precision: 'state' }).ok, true);
  assert.equal(evaluateEarnedPrecision({ ...base, kind: 'institution' }).ok, true);
});

test('site precision on a fallback geocode fails the provenance rule', () => {
  const claims = [{ predicate: 'published_from' }];
  const pub = { ...base, kind: 'publication', claims };
  const r = evaluateEarnedPrecision({ ...pub, matchMethod: 'geocode_other' });
  assert.equal(!r.ok && r.rule, 'site_provenance');
  assert.equal(evaluateEarnedPrecision({ ...pub, matchMethod: 'geocode_census' }).ok, true);
  const city = { ...base, kind: 'place', precision: 'city', matchMethod: 'geocode_other' };
  assert.equal(evaluateEarnedPrecision(city).ok, true);
});
