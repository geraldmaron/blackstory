import assert from 'node:assert/strict';
import { test } from 'node:test';
import { edtfBounds, validateApplicability, type AuthoredApplicability } from './applicability.js';

const context = {
  entityIds: new Set(['ent_law_fair_housing_act_1968', 'ent_case_plessy_v_ferguson_1896']),
  jurisdictionIds: new Set(['nation:US', 'state:17', 'region:chicago-il', 'county:17031']),
  claimText: new Map([
    ['claim_fha_01', 'April 11, 1968, by President Lyndon B. Johnson'],
    ['claim_plessy_01', 'May 18, 1896, 163 U.S. 537'],
    ['claim_brown_01', 'May 17, 1954, 347 U.S. 483'],
  ]),
};

function authored(overrides: Partial<AuthoredApplicability> = {}): AuthoredApplicability {
  return {
    id: 'fha-1968-us',
    entityId: 'ent_law_fair_housing_act_1968',
    jurisdictionId: 'nation:US',
    scopeLevel: 'federal',
    inForceFromEdtf: '1968-04-11',
    appliesToSlices: ['all'],
    lifeDomains: ['housing', 'credit'],
    textPosture: 'protective',
    basisClaimIds: ['claim_fha_01'],
    ...overrides,
  };
}

test('EDTF bounds cover year, month and day precision', () => {
  assert.deepEqual(edtfBounds('1968'), {
    earliest: '1968-01-01',
    latest: '1968-12-31',
    precision: 'year',
    year: 1968,
  });
  assert.equal(edtfBounds('1968-02').latest, '1968-02-29');
  assert.equal(edtfBounds('1968-04-11').precision, 'day');
  assert.throws(() => edtfBounds('1968-13'));
  assert.throws(() => edtfBounds('1968-02-30'));
  assert.throws(() => edtfBounds('circa 1968'));
});

test('a valid open-ended row builds an unbounded daterange', () => {
  const result = validateApplicability(authored(), context);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.row.in_force_span, '[1968-04-11,)');
    assert.equal(result.row.date_precision, 'day');
    assert.equal(result.row.status, 'published');
  }
});

test('an ended rule uses an exclusive upper bound the day after it ended', () => {
  const result = validateApplicability(
    authored({
      id: 'plessy-1896-us',
      entityId: 'ent_case_plessy_v_ferguson_1896',
      inForceFromEdtf: '1896-05-18',
      inForceToEdtf: '1954-05-17',
      textPosture: 'exclusionary',
      lifeDomains: ['public_accommodation', 'schooling'],
      basisClaimIds: ['claim_plessy_01', 'claim_brown_01'],
    }),
    context,
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.row.in_force_span, '[1896-05-18,1954-05-18)');
});

test('years must come from the cited claims, not from elsewhere', () => {
  const result = validateApplicability(authored({ inForceFromEdtf: '1866' }), context);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(' '), /1866 does not appear/);
});

test('scope must match the jurisdiction level', () => {
  const result = validateApplicability(authored({ jurisdictionId: 'state:17' }), context);
  assert.equal(result.ok, false);
  if (!result.ok)
    assert.match(result.errors.join(' '), /federal scope cannot sit on jurisdiction state:17/);
});

test('unknown entities, claims, slices and domains are rejected', () => {
  const result = validateApplicability(
    authored({
      entityId: 'ent_law_missing',
      basisClaimIds: ['claim_missing'],
      appliesToSlices: ['black_alone'],
      lifeDomains: ['vibes'],
    }),
    context,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    const text = result.errors.join(' | ');
    assert.match(text, /not in the published catalog/);
    assert.match(text, /not a published claim/);
    assert.match(text, /slice black_alone/);
    assert.match(text, /life domain vibes/);
  }
});

test('a facially neutral rule publishes with or without a disputed flag', () => {
  const plain = validateApplicability(authored({ textPosture: 'facially_neutral' }), context);
  assert.equal(plain.ok, true);
  const disputed = validateApplicability(
    authored({ textPosture: 'facially_neutral', disputed: true }),
    context,
  );
  assert.equal(disputed.ok, true);
  if (disputed.ok) assert.equal(disputed.row.disputed, true);
});
