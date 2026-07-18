import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateFactDerivationConsistency,
  maxFactConfidenceGradeForClaim,
  type FactDerivationBackingClaim,
} from './derivation.js';

function backingClaim(overrides: Partial<FactDerivationBackingClaim> = {}): FactDerivationBackingClaim {
  return {
    id: 'claim-1',
    workflowStatus: 'accepted',
    publicationStatus: 'published',
    confidence: {
      score: 0.9,
      components: {
        sourceAuthority: 0.9,
        directness: 0.8,
        lineageIndependence: 0.9,
        temporalProximity: 0.8,
        geographicPrecision: 0.8,
        entityMatchQuality: 0.8,
        extractionQuality: 0.8,
        contradictionPenalty: 0,
      },
      policyVersion: 'v1',
      independentLineageCount: 3,
      supportingEvidenceCount: 3,
      contradictingEvidenceCount: 0,
      contributingEvidenceIds: ['ev-1', 'ev-2', 'ev-3'],
      calculatedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

test('a fact with no declared derivation always passes (nothing to check)', () => {
  const result = evaluateFactDerivationConsistency({
    fact: { citations: [], confidence: 'established', derivedFromClaimIds: [] },
    backingClaims: [],
  });
  assert.deepEqual(result, { ok: true });
});

test('an unresolved claim id fails closed rather than being silently skipped', () => {
  const result = evaluateFactDerivationConsistency({
    fact: { citations: [], confidence: 'established', derivedFromClaimIds: ['claim-missing'] },
    backingClaims: [],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'unresolved_claim_id');
});

test('maxFactConfidenceGradeForClaim caps at contested for an unpublished claim', () => {
  const claim = backingClaim({ workflowStatus: 'proposed', publicationStatus: 'unpublished' });
  assert.equal(maxFactConfidenceGradeForClaim(claim), 'contested');
});

test('maxFactConfidenceGradeForClaim caps at contested when the claim has contradicting evidence', () => {
  const claim = backingClaim({
    confidence: { ...backingClaim().confidence!, contradictingEvidenceCount: 1 },
  });
  assert.equal(maxFactConfidenceGradeForClaim(claim), 'contested');
});

test('maxFactConfidenceGradeForClaim allows established for multiple high-authority lineages', () => {
  assert.equal(maxFactConfidenceGradeForClaim(backingClaim()), 'established');
});

test('maxFactConfidenceGradeForClaim caps at corroborated for multiple lineages below the authority floor', () => {
  const claim = backingClaim({
    confidence: {
      ...backingClaim().confidence!,
      components: { ...backingClaim().confidence!.components, sourceAuthority: 0.5 },
    },
  });
  assert.equal(maxFactConfidenceGradeForClaim(claim), 'corroborated');
});

test('maxFactConfidenceGradeForClaim caps at single-source for exactly one lineage', () => {
  const claim = backingClaim({
    confidence: { ...backingClaim().confidence!, independentLineageCount: 1 },
  });
  assert.equal(maxFactConfidenceGradeForClaim(claim), 'single-source');
});

test('a fact cannot claim stronger confidence than its backing claim supports', () => {
  const weakClaim = backingClaim({ confidence: { ...backingClaim().confidence!, independentLineageCount: 1 } });
  const result = evaluateFactDerivationConsistency({
    fact: { citations: [], confidence: 'established', derivedFromClaimIds: ['claim-1'] },
    backingClaims: [weakClaim],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'confidence_exceeds_backing_claims');
});

test('a fact matching its backing claim ceiling passes', () => {
  const result = evaluateFactDerivationConsistency({
    fact: { citations: [], confidence: 'established', derivedFromClaimIds: ['claim-1'] },
    backingClaims: [backingClaim()],
  });
  assert.deepEqual(result, { ok: true });
});

test('a fact derived from multiple claims is capped by the WEAKEST backing claim', () => {
  const strongClaim = backingClaim({ id: 'claim-strong' });
  const weakClaim = backingClaim({
    id: 'claim-weak',
    confidence: { ...backingClaim().confidence!, independentLineageCount: 1 },
  });
  const result = evaluateFactDerivationConsistency({
    fact: { citations: [], confidence: 'established', derivedFromClaimIds: ['claim-strong', 'claim-weak'] },
    backingClaims: [strongClaim, weakClaim],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'confidence_exceeds_backing_claims');
});

test('a citation documentId not among the backing claims evidence is flagged untraceable', () => {
  const result = evaluateFactDerivationConsistency({
    fact: {
      citations: [
        {
          csl: { id: 'csl-1', type: 'webpage' },
          sourceClass: 'primary',
          role: 'supports',
          excerpt: 'excerpt',
          documentId: 'doc-not-in-claim',
        },
      ],
      confidence: 'single-source',
      derivedFromClaimIds: ['claim-1'],
    },
    backingClaims: [backingClaim({ confidence: { ...backingClaim().confidence!, independentLineageCount: 1 } })],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'citation_untraceable_to_backing_evidence');
});

test('a citation documentId that IS among the backing claims evidence passes', () => {
  const result = evaluateFactDerivationConsistency({
    fact: {
      citations: [
        {
          csl: { id: 'csl-1', type: 'webpage' },
          sourceClass: 'primary',
          role: 'supports',
          excerpt: 'excerpt',
          documentId: 'ev-1',
        },
      ],
      confidence: 'established',
      derivedFromClaimIds: ['claim-1'],
    },
    backingClaims: [backingClaim()],
  });
  assert.deepEqual(result, { ok: true });
});

test('a citation without a documentId is not checkable and passes through', () => {
  const result = evaluateFactDerivationConsistency({
    fact: {
      citations: [
        {
          csl: { id: 'csl-1', type: 'webpage' },
          sourceClass: 'primary',
          role: 'supports',
          excerpt: 'excerpt',
        },
      ],
      confidence: 'established',
      derivedFromClaimIds: ['claim-1'],
    },
    backingClaims: [backingClaim()],
  });
  assert.deepEqual(result, { ok: true });
});
