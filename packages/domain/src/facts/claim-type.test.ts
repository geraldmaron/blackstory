import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FACT_CLAIM_TYPES,
  assertFactClaimTypeValid,
  claimTypeRequiresGeo,
  claimTypeRequiresWhen,
  isFactClaimType,
  CLAIM_TYPE_ABOUT_SCHEMA_TYPE,
} from './claim-type.js';

test('isFactClaimType recognizes every closed-vocab value and rejects unknowns', () => {
  for (const type of FACT_CLAIM_TYPES) {
    assert.equal(isFactClaimType(type), true);
  }
  assert.equal(isFactClaimType('speculation'), false);
});

test('assertFactClaimTypeValid throws on an unknown claim type', () => {
  assert.throws(() => assertFactClaimTypeValid('bogus'));
  assert.doesNotThrow(() => assertFactClaimTypeValid('event'));
});

test('event and place-designation require geo; the rest do not', () => {
  assert.equal(claimTypeRequiresGeo('event'), true);
  assert.equal(claimTypeRequiresGeo('place-designation'), true);
  assert.equal(claimTypeRequiresGeo('quantity'), false);
  assert.equal(claimTypeRequiresGeo('quote-attribution'), false);
});

test('every claim type except quantity requires a when anchor', () => {
  assert.equal(claimTypeRequiresWhen('quantity'), false);
  for (const type of FACT_CLAIM_TYPES) {
    if (type === 'quantity') continue;
    assert.equal(claimTypeRequiresWhen(type), true);
  }
});

test('every claim type maps to a schema.org about type', () => {
  for (const type of FACT_CLAIM_TYPES) {
    assert.ok(CLAIM_TYPE_ABOUT_SCHEMA_TYPE[type].length > 0);
  }
});
