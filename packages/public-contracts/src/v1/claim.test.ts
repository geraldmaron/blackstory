import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from '../testing/load-fixture.js';
import { claimV1Schema } from './claim.js';

const VALID_CLAIM = {
  id: 'BB-F-000003',
  predicate: 'renamed_to',
  object: 'Paul Laurence Dunbar High School',
  confidenceScore: 0.85,
  confidenceLevel: 'high' as const,
  citation: { source: 'D.C. Board of Education annual report, 1916', label: '1916 annual report' },
};

test('round-trips a minimal valid claim', () => {
  assert.deepEqual(claimV1Schema.parse(VALID_CLAIM), VALID_CLAIM);
});

test('round-trips a claim carrying dispute + revisionHistory + retraction (provenance stays visible)', () => {
  const input = {
    ...VALID_CLAIM,
    dispute: {
      hasDispute: true,
      primaryValue: 'Paul Laurence Dunbar High School',
      note: 'One source lists a different rename year.',
      alternates: [{ value: '1917', credible: false, kind: 'contradicting' as const }],
    },
    revisionHistory: [
      { id: 'rev_1', changedAt: '2026-01-15T00:00:00.000Z', changeKind: 'created' as const, summary: 'Initial fact record created.' },
    ],
    retraction: { retractedAt: '2026-02-01T00:00:00.000Z', reason: 'Superseded by a corrected fact.', supersededByClaimId: 'BB-F-000010' },
  };
  const parsed = claimV1Schema.parse(input);
  assert.deepEqual(parsed, input);
  assert.equal(parsed.dispute?.hasDispute, true, 'disputes must remain visible on the public shape');
  assert.equal(parsed.retraction?.reason, input.retraction.reason, 'provenance (retraction) must remain visible');
});

test('rejects an unknown confidenceLevel (adversarial: unknown enum value)', () => {
  assert.throws(() => claimV1Schema.parse({ ...VALID_CLAIM, confidenceLevel: 'very-high' }));
});

test('rejects a confidenceScore outside [0,1] (adversarial: out-of-range numeric)', () => {
  assert.throws(() => claimV1Schema.parse({ ...VALID_CLAIM, confidenceScore: 42 }));
});

test('rejects an oversized object/predicate (adversarial: maliciously large DTO)', () => {
  assert.throws(() => claimV1Schema.parse({ ...VALID_CLAIM, object: 'x'.repeat(10_000) }));
});

test('drops internal-only sourceLineage/reviewer/coverage-notes fields on parse (sensitive-field negative snapshot)', () => {
  const fixture = loadFixture<Record<string, unknown>>('claim.v1.sensitive-leak.json');
  const parsed = claimV1Schema.parse(fixture);
  assert.equal(parsed.id, fixture.id);
  for (const forbiddenKey of [
    'sourceLineage',
    'researchCoverage',
    'relevanceNote',
    'connectionStrengthNote',
    'reviewerId',
  ]) {
    assert.ok(!(forbiddenKey in parsed), `${forbiddenKey} must not survive parsing`);
  }
});
