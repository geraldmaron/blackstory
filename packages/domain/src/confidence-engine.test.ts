/**
 * Acceptance tests for versioned confidence recalculation, lineage collapse, language caps, and export.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadProductConstitution, type ProductConstitution } from '@repo/schemas';
import type { ClaimEvidenceLink } from './claims/evidence-link.js';
import {
  exportConfidenceCalibrationDataset,
  evaluatePublicLanguage,
  recalculateConfidence,
} from './confidence-engine/index.js';

const FIXED_NOW = '2026-07-17T04:00:00.000Z';
const POLICY = loadProductConstitution();

function evidence(
  id: string,
  lineageRootId: string,
  overrides: Partial<ClaimEvidenceLink> = {},
): ClaimEvidenceLink {
  return {
    id: `link_${id}`,
    claimId: 'claim_043',
    claimVersionId: 'claim_043_v1',
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
    ...overrides,
  };
}

function score(links: readonly ClaimEvidenceLink[]) {
  return recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: links,
    calculatedAt: FIXED_NOW,
    policy: POLICY,
  });
}

test('five syndicated copies count as one independent source', () => {
  const copies = Array.from({ length: 5 }, (_, index) =>
    evidence(`copy_${index + 1}`, 'wire_root'),
  );
  const result = score(copies);

  assert.equal(result.supportingEvidenceCount, 5);
  assert.equal(result.independentLineageCount, 1);
  assert.equal(result.contributingEvidenceIds.length, 1);
  assert.equal(result.components.lineageIndependence, 0.4);
});

test('identical reordered inputs produce deterministic score and fingerprints', () => {
  const links = [evidence('a', 'root_a'), evidence('b', 'root_b')];
  const first = score(links);
  const second = score([...links].reverse());

  assert.equal(first.score, second.score);
  assert.deepEqual(first.components, second.components);
  assert.deepEqual(first.contributingEvidenceIds, second.contributingEvidenceIds);
  assert.deepEqual(first.audit.inputFingerprints, second.audit.inputFingerprints);
  assert.equal(first.audit.engineVersion, 'confidence-engine.v1');
  assert.equal(first.audit.componentVersions.sourceAuthority, 'confidence-components.v1');
});

test('recalculation audits source, evidence, contradiction, and policy changes', () => {
  const baseLinks = [evidence('a', 'root_a')];
  const initial = score(baseLinks);

  const sourceChanged = recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: [
      evidence('a', 'root_a', { sourceClassification: 'primary_archival' }),
    ],
    calculatedAt: FIXED_NOW,
    policy: POLICY,
    previous: initial,
  });
  assert.ok(sourceChanged.audit.recalculationReasons.includes('source'));
  assert.notEqual(sourceChanged.score, initial.score);

  const evidenceChanged = recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: [evidence('a', 'root_a', { extractionQuality: 0.2 })],
    calculatedAt: FIXED_NOW,
    policy: POLICY,
    previous: initial,
  });
  assert.ok(evidenceChanged.audit.recalculationReasons.includes('evidence'));
  assert.notEqual(evidenceChanged.score, initial.score);

  const contradictionChanged = recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: [
      ...baseLinks,
      evidence('contra', 'root_contra', {
        role: 'contradicting',
        assertedValue: 'different',
      }),
    ],
    calculatedAt: FIXED_NOW,
    policy: POLICY,
    previous: initial,
  });
  assert.ok(contradictionChanged.audit.recalculationReasons.includes('contradiction'));
  assert.ok(contradictionChanged.score < initial.score);

  const changedPolicy: ProductConstitution = {
    ...POLICY,
    policyVersion: '1.0.1',
    claimConfidenceThresholds: {
      ...POLICY.claimConfidenceThresholds,
      standardPublish: 0.8,
    },
  };
  const policyChanged = recalculateConfidence({
    claimClass: 'standard',
    evidenceLinks: baseLinks,
    calculatedAt: FIXED_NOW,
    policy: changedPolicy,
    previous: initial,
  });
  assert.deepEqual(policyChanged.audit.recalculationReasons, ['policy']);
  assert.equal(policyChanged.threshold, 0.8);
  assert.equal(policyChanged.policyVersion, '1.0.1');
});

test('public language is capped by evidence procedural status', () => {
  const evaluation = evaluatePublicLanguage({
    text: 'The person was convicted.',
    requestedProceduralStatus: 'convicted',
    evidenceProceduralStatus: 'charged',
    policy: POLICY,
  });

  assert.equal(evaluation.allowed, false);
  assert.equal(evaluation.effectiveProceduralStatus, 'charged');
  assert.ok(evaluation.violations.includes('procedural_status_exceeds_evidence'));

  const supported = evaluatePublicLanguage({
    text: 'The person was charged.',
    requestedProceduralStatus: 'charged',
    evidenceProceduralStatus: 'charged',
    policy: POLICY,
  });
  assert.equal(supported.allowed, true);

  const weaker = evaluatePublicLanguage({
    text: 'The person was alleged to have acted.',
    requestedProceduralStatus: 'alleged',
    evidenceProceduralStatus: 'charged',
    policy: POLICY,
  });
  assert.equal(weaker.allowed, true);
});

test('calibration export is stable, versioned, and carries audit metadata', () => {
  const confidence = score([evidence('a', 'root_a'), evidence('b', 'root_b')]);
  const dataset = exportConfidenceCalibrationDataset({
    exportedAt: FIXED_NOW,
    cases: [
      {
        claimId: 'claim_b',
        claimVersionId: 'v1',
        claimClass: 'standard',
        confidence,
      },
      {
        claimId: 'claim_a',
        claimVersionId: 'v2',
        claimClass: 'standard',
        confidence,
        observedOutcome: true,
        outcomeSource: 'reviewed_gold_fixture',
      },
    ],
  });

  assert.equal(dataset.schemaVersion, 'confidence-calibration-dataset.v1');
  assert.deepEqual(dataset.rows.map((row) => row.claimId), ['claim_a', 'claim_b']);
  assert.equal(dataset.rows[0]?.engineVersion, 'confidence-engine.v1');
  assert.equal(dataset.rows[0]?.componentVersions.threshold, 'constitution-policy.v1');
  assert.match(dataset.rows[0]?.inputFingerprints.evidence ?? '', /^sha256:[a-f0-9]{64}$/);
});
