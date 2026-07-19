/**
 * Unit tests for the reviewer-agreement corroboration signal an additive input to
 * confidence engine. These tests intentionally exercise `computeReviewerAgreementSignal`
 * and `withReviewerAgreementCorroboration` in isolation from `recalculateConfidence` to prove
 * the addition is self-contained and does not alter the existing scorer.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadProductConstitution } from '@repo/schemas';
import type { ClaimEvidenceLink } from '../claims/evidence-link.js';
import {
  REVIEWER_AGREEMENT_MAX_WEIGHT,
  computeReviewerAgreementSignal,
  recalculateConfidence,
  withReviewerAgreementCorroboration,
  type AuditedConfidenceResult,
} from './index.js';

const FIXED_NOW = '2026-07-17T04:00:00.000Z';
const POLICY = loadProductConstitution();

function evidence(id: string, lineageRootId: string): ClaimEvidenceLink {
  return {
    id: `link_${id}`,
    claimId: 'claim_076',
    claimVersionId: 'claim_076_v1',
    evidenceId: id,
    role: 'supporting',
    lineageRootId,
    credible: true,
    sourceClassification: 'government_record',
    directness: 0.9,
    temporalProximity: 0.8,
    geographicPrecision: 0.85,
    entityMatchQuality: 0.95,
    extractionQuality: 0.9,
    createdAt: FIXED_NOW,
  };
}

function baseResult(): AuditedConfidenceResult {
  return recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: [evidence('a', 'root_a')],
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
}

test('computeReviewerAgreementSignal is pure and deterministic', () => {
  const input = { reviewCount: 3, agreementRatio: 1, verdict: 'corroborates' as const };
  const first = computeReviewerAgreementSignal(input);
  const second = computeReviewerAgreementSignal(input);
  assert.deepEqual(first, second);
  assert.equal(first.fingerprint, second.fingerprint);
});

test('computeReviewerAgreementSignal caps corroborationWeight at REVIEWER_AGREEMENT_MAX_WEIGHT', () => {
  const fullAgreement = computeReviewerAgreementSignal({
    reviewCount: 5,
    agreementRatio: 1,
    verdict: 'corroborates',
  });
  assert.equal(fullAgreement.corroborationWeight, REVIEWER_AGREEMENT_MAX_WEIGHT);

  const partialAgreement = computeReviewerAgreementSignal({
    reviewCount: 3,
    agreementRatio: 0.5,
    verdict: 'corroborates',
  });
  assert.ok(partialAgreement.corroborationWeight < REVIEWER_AGREEMENT_MAX_WEIGHT);
  assert.ok(partialAgreement.corroborationWeight > 0);
});

test('computeReviewerAgreementSignal assigns zero weight to disputes and inconclusive verdicts', () => {
  const disputes = computeReviewerAgreementSignal({
    reviewCount: 3,
    agreementRatio: 1,
    verdict: 'disputes',
  });
  assert.equal(disputes.corroborationWeight, 0);

  const inconclusive = computeReviewerAgreementSignal({
    reviewCount: 3,
    agreementRatio: 0.4,
    verdict: 'inconclusive',
  });
  assert.equal(inconclusive.corroborationWeight, 0);
});

test('computeReviewerAgreementSignal validates its inputs', () => {
  assert.throws(
    () => computeReviewerAgreementSignal({ reviewCount: -1, agreementRatio: 1, verdict: 'corroborates' }),
    /reviewCount/,
  );
  assert.throws(
    () => computeReviewerAgreementSignal({ reviewCount: 3, agreementRatio: 1.5, verdict: 'corroborates' }),
    /agreementRatio/,
  );
});

test('withReviewerAgreementCorroboration boosts score for a corroborating signal, bounded to 1', () => {
  const result = baseResult();
  const signal = computeReviewerAgreementSignal({
    reviewCount: 3,
    agreementRatio: 1,
    verdict: 'corroborates',
  });
  const adjusted = withReviewerAgreementCorroboration(result, signal);
  assert.ok(adjusted.score >= result.score);
  assert.ok(adjusted.score <= 1);
  assert.equal(adjusted.score, Math.min(1, Math.round((result.score + signal.corroborationWeight) * 10_000) / 10_000));
  assert.equal(adjusted.passesPublishThreshold, adjusted.score >= adjusted.threshold);
});

test('withReviewerAgreementCorroboration is a no-op for disputes — never silently resolves disagreement', () => {
  const result = baseResult();
  const signal = computeReviewerAgreementSignal({
    reviewCount: 3,
    agreementRatio: 1,
    verdict: 'disputes',
  });
  const adjusted = withReviewerAgreementCorroboration(result, signal);
  assert.deepEqual(adjusted, result);
});

test('withReviewerAgreementCorroboration is a no-op for inconclusive agreement', () => {
  const result = baseResult();
  const signal = computeReviewerAgreementSignal({
    reviewCount: 4,
    agreementRatio: 0.5,
    verdict: 'inconclusive',
  });
  const adjusted = withReviewerAgreementCorroboration(result, signal);
  assert.deepEqual(adjusted, result);
});

test('withReviewerAgreementCorroboration never mutates the original result', () => {
  const result = baseResult();
  const frozenScore = result.score;
  const signal = computeReviewerAgreementSignal({
    reviewCount: 3,
    agreementRatio: 1,
    verdict: 'corroborates',
  });
  withReviewerAgreementCorroboration(result, signal);
  assert.equal(result.score, frozenScore);
});

test('withReviewerAgreementCorroboration does not change recalculateConfidence inputs or fingerprints', () => {
  const result = baseResult();
  const signal = computeReviewerAgreementSignal({
    reviewCount: 3,
    agreementRatio: 1,
    verdict: 'corroborates',
  });
  const adjusted = withReviewerAgreementCorroboration(result, signal);
  assert.deepEqual(adjusted.audit.inputFingerprints, result.audit.inputFingerprints);
  assert.deepEqual(adjusted.components, result.components);
});
