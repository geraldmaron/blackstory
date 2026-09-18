import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { evaluateEvidencePilotReceiptBudget } from './evidence-retrieval-cost.js';
import {
  evaluateHeldoutIdentityAndEdges,
  parseHeldoutQualityCases,
  verifyHeldoutQualityArtifacts,
} from './heldout-quality-eval.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function fixture() {
  const cases = {
    schemaVersion: 'heldout-identity-edge-corpus.v1' as const,
    version: 'blind-v1',
    retrievedAt: '2026-09-18T00:00:00.000Z',
    protocol: 'Labels are withheld.',
    sourceExcerpts: [
      {
        id: 'source-a',
        sourceUrl: 'https://example.gov/a',
        selector: 'paragraph 1',
        excerpt: 'A source excerpt.',
      },
    ],
    identityCases: [
      {
        id: 'i1',
        left: { name: 'Alpha', sourceExcerptId: 'source-a' },
        right: { name: 'Alpha', sourceExcerptId: 'source-a' },
      },
      {
        id: 'i2',
        left: { name: 'Alpha', sourceExcerptId: 'source-a' },
        right: { name: 'Beta', sourceExcerptId: 'source-a' },
      },
      {
        id: 'i3',
        left: { name: 'Gamma', sourceExcerptId: 'source-a' },
        right: { name: 'Gamma', sourceExcerptId: 'source-a' },
      },
    ],
    edgeCases: [
      {
        id: 'e1',
        subject: 'Alpha',
        predicate: 'related-to',
        object: 'Beta',
        sourceExcerptIds: ['source-a'],
      },
      {
        id: 'e2',
        subject: 'Beta',
        predicate: 'related-to',
        object: 'Gamma',
        sourceExcerptIds: ['source-a'],
      },
      {
        id: 'e3',
        subject: 'Gamma',
        predicate: 'related-to',
        object: 'Alpha',
        sourceExcerptIds: ['source-a'],
      },
    ],
  };
  const predictions = {
    schemaVersion: 'heldout-identity-edge-predictions.v1' as const,
    benchmarkVersion: 'blind-v1',
    predictor: 'frozen-categorical-test',
    generatedAt: '2026-09-18T00:00:00.000Z',
    identityPredictions: [
      { id: 'i1', decision: 'merge' as const },
      { id: 'i2', decision: 'merge' as const },
      { id: 'i3', decision: 'distinct' as const },
    ],
    edgePredictions: [
      { id: 'e1', decision: 'assert' as const },
      { id: 'e2', decision: 'assert' as const },
      { id: 'e3', decision: 'withhold' as const },
    ],
  };
  const gold = {
    schemaVersion: 'heldout-identity-edge-gold.v1' as const,
    benchmarkVersion: 'blind-v1',
    labelStatus: 'independent test labels',
    adjudicationProtocol: 'A separate reviewer labeled the frozen cases.',
    limitations: ['Small test fixture.'],
    identityCases: [
      { id: 'i1', expected: 'same' as const, rationale: 'Same contextual identity.' },
      { id: 'i2', expected: 'distinct' as const, rationale: 'Different contextual identity.' },
      { id: 'i3', expected: 'same' as const, rationale: 'Same contextual identity.' },
    ],
    edgeCases: [
      { id: 'e1', expected: 'supported' as const, rationale: 'Directly stated.' },
      { id: 'e2', expected: 'unsupported' as const, rationale: 'Not directly stated.' },
      { id: 'e3', expected: 'supported' as const, rationale: 'Directly stated.' },
    ],
  };
  return { cases, predictions, gold };
}

test('measures false merges and unsupported edge assertions without probability claims', () => {
  const result = evaluateHeldoutIdentityAndEdges(fixture()) as {
    identity: Record<string, number>;
    edges: Record<string, number>;
    probabilityCalibration: Record<string, unknown>;
  };

  assert.equal(result.identity.falseMergeCount, 1);
  assert.equal(result.identity.falseMergeRate, 1);
  assert.equal(result.identity.missedMergeCount, 1);
  assert.equal(result.edges.unsupportedAssertionCount, 1);
  assert.equal(result.edges.unsupportedEdgeRate, 1);
  assert.equal(result.edges.assertedEdgeFalseDiscoveryRate, 0.5);
  assert.equal(result.edges.missedSupportedEdgeCount, 1);
  assert.deepEqual(result.probabilityCalibration, {
    status: 'unavailable',
    probabilityClaimSupported: false,
    reason: 'The frozen predictor emitted categorical decisions and no probabilities.',
  });
});

test('rejects incomplete frozen predictions', () => {
  const valid = fixture();
  assert.throws(
    () =>
      evaluateHeldoutIdentityAndEdges({
        ...valid,
        predictions: { ...valid.predictions, identityPredictions: [] },
      }),
    /array must be nonempty/,
  );
});

test('rejects zero-case measurements, unknown labels, and invalid timestamps', () => {
  const valid = fixture();
  assert.throws(
    () =>
      evaluateHeldoutIdentityAndEdges({
        ...valid,
        cases: { ...valid.cases, identityCases: [] },
      }),
    /array must be nonempty/,
  );
  assert.throws(
    () =>
      evaluateHeldoutIdentityAndEdges({
        ...valid,
        predictions: {
          ...valid.predictions,
          identityPredictions: [{ id: 'i1', decision: 'likely' }],
        },
      }),
    /categorical contract vocabulary/,
  );
  assert.throws(
    () =>
      evaluateHeldoutIdentityAndEdges({
        ...valid,
        predictions: { ...valid.predictions, generatedAt: 'not-a-date' },
      }),
    /valid timestamp/,
  );
});

test('strict blind shape rejects expected labels or rationales in case inputs', () => {
  const valid = fixture();
  assert.throws(
    () =>
      parseHeldoutQualityCases({
        ...valid.cases,
        identityCases: [{ ...valid.cases.identityCases[0], expected: 'same' }],
      }),
    /must contain exactly/,
  );
  assert.throws(
    () =>
      parseHeldoutQualityCases({
        ...valid.cases,
        edgeCases: [{ ...valid.cases.edgeCases[0], rationale: 'leaked gold' }],
      }),
    /must contain exactly/,
  );
});

test('artifact binding fails closed when case bytes change after the integrity record', () => {
  const valid = fixture();
  const casesRaw = `${JSON.stringify(valid.cases, null, 2)}\n`;
  const predictionsRaw = `${JSON.stringify(valid.predictions, null, 2)}\n`;
  const goldRaw = `${JSON.stringify(valid.gold, null, 2)}\n`;
  const manifest = {
    schemaVersion: 'heldout-identity-edge-freeze.v1',
    benchmarkVersion: 'blind-v1',
    recordedAt: '2026-09-18T00:00:01.000Z',
    bindingStatus: 'posthoc-integrity-record',
    originalBlindFileByteSha256: digest(casesRaw),
    currentBlindFileByteSha256: digest(casesRaw),
    blindCanonicalJsonSha256: digest(JSON.stringify(valid.cases)),
    frozenPredictionsFileByteSha256: digest(predictionsRaw),
    independentGoldFileByteSha256: digest(goldRaw),
    limitation: 'The integrity record was written after prediction and gold authorship.',
  };
  assert.equal(
    verifyHeldoutQualityArtifacts({ casesRaw, predictionsRaw, goldRaw, manifest }).cases.version,
    'blind-v1',
  );
  assert.throws(
    () =>
      verifyHeldoutQualityArtifacts({
        casesRaw: casesRaw.replace('Alpha', 'Changed Alpha'),
        predictionsRaw,
        goldRaw,
        manifest,
      }),
    /integrity mismatch/,
  );
});

test('rates are unavailable rather than zero when challenge classes are absent', () => {
  const valid = fixture();
  const result = evaluateHeldoutIdentityAndEdges({
    cases: {
      ...valid.cases,
      identityCases: [valid.cases.identityCases[0]],
      edgeCases: [valid.cases.edgeCases[0]],
    },
    predictions: {
      ...valid.predictions,
      identityPredictions: [{ id: 'i1', decision: 'merge' }],
      edgePredictions: [{ id: 'e1', decision: 'withhold' }],
    },
    gold: {
      ...valid.gold,
      identityCases: [valid.gold.identityCases[0]],
      edgeCases: [valid.gold.edgeCases[0]],
    },
  }) as {
    identity: Record<string, unknown>;
    edges: Record<string, unknown>;
  };
  assert.equal(result.identity.falseMergeRate, null);
  assert.equal(result.identity.falseMergeCoverage, 'unavailable_no_distinct_cases');
  assert.equal(result.edges.unsupportedEdgeRate, null);
  assert.equal(result.edges.unsupportedEdgeCoverage, 'unavailable_no_unsupported_cases');
  assert.equal(result.edges.assertedEdgeFalseDiscoveryRate, null);
  assert.equal(result.edges.assertedEdgeFalseDiscoveryCoverage, 'unavailable_no_asserted_edges');
});

test('provider receipts over the total cap fail the recorded budget gate', () => {
  assert.deepEqual(
    evaluateEvidencePilotReceiptBudget({
      priorReservedCostUsd: 0.2,
      providerReportedCostUsd: 0.06,
      totalCostCapUsd: 0.25,
    }),
    {
      passed: false,
      reservationPassed: true,
      providerReceiptAvailable: true,
      cumulativeProviderReportedCostUsd: 0.26,
      failureReason: 'reported_charge_exceeded_total_cost_cap',
    },
  );
});

test('a missing provider cost stays explicitly unavailable without inventing an overage', () => {
  assert.deepEqual(
    evaluateEvidencePilotReceiptBudget({
      priorReservedCostUsd: 0.2,
      providerReportedCostUsd: null,
      totalCostCapUsd: 0.25,
    }),
    {
      passed: true,
      reservationPassed: true,
      providerReceiptAvailable: false,
      cumulativeProviderReportedCostUsd: null,
      failureReason: null,
    },
  );
});

test('a prior reservation over the total cap fails before receipt accounting', () => {
  assert.deepEqual(
    evaluateEvidencePilotReceiptBudget({
      priorReservedCostUsd: 0.26,
      providerReportedCostUsd: null,
      totalCostCapUsd: 0.25,
    }),
    {
      passed: false,
      reservationPassed: false,
      providerReceiptAvailable: false,
      cumulativeProviderReportedCostUsd: null,
      failureReason: 'prior_reservation_exceeded_total_cost_cap',
    },
  );
});
