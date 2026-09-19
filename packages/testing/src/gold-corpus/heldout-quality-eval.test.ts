import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluateEvidencePilotReceiptBudget } from './evidence-retrieval-cost.js';
import {
  evaluateHeldoutIdentityAndEdges,
  parseHeldoutQualityCases,
  verifyHeldoutQualityArtifacts,
} from './heldout-quality-eval.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

const fixtureRaw = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const artifactRaw = (name: string) =>
  readFileSync(new URL(`./artifacts/${name}`, import.meta.url), 'utf8');

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

test('committed held-out measurement matches the bound categorical artifacts', () => {
  const casesRaw = fixtureRaw('heldout-identity-edge-corpus.v1.json');
  const predictionsRaw = fixtureRaw('heldout-identity-edge-predictions.v1.json');
  const goldRaw = fixtureRaw('heldout-identity-edge-gold.v1.json');
  const verified = verifyHeldoutQualityArtifacts({
    casesRaw,
    predictionsRaw,
    goldRaw,
    manifest: JSON.parse(fixtureRaw('heldout-identity-edge-freeze.v1.json')) as unknown,
  });
  const measured = evaluateHeldoutIdentityAndEdges(verified) as {
    identity: Record<string, unknown>;
    edges: Record<string, unknown>;
    probabilityCalibration: Record<string, unknown>;
  };
  const committed = JSON.parse(fixtureRaw('heldout-quality-measurement.v1.json')) as {
    rawArtifact: { location: string; sha256: string };
    inputs: Record<string, unknown>;
    identity: Record<string, unknown>;
    edges: Record<string, unknown>;
    probabilityCalibration: Record<string, unknown>;
  };

  assert.deepEqual(committed.identity, {
    caseCount: measured.identity.caseCount,
    distinctCaseCount: measured.identity.distinctCaseCount,
    falseMergeCount: measured.identity.falseMergeCount,
    falseMergeRate: measured.identity.falseMergeRate,
    falseMergeCoverage: measured.identity.falseMergeCoverage,
    missedMergeCount: measured.identity.missedMergeCount,
  });
  assert.deepEqual(committed.edges, {
    caseCount: measured.edges.caseCount,
    unsupportedCaseCount: measured.edges.unsupportedCaseCount,
    unsupportedAssertionCount: measured.edges.unsupportedAssertionCount,
    unsupportedEdgeRate: measured.edges.unsupportedEdgeRate,
    unsupportedEdgeCoverage: measured.edges.unsupportedEdgeCoverage,
    assertedEdgeFalseDiscoveryRate: measured.edges.assertedEdgeFalseDiscoveryRate,
    assertedEdgeFalseDiscoveryCoverage: measured.edges.assertedEdgeFalseDiscoveryCoverage,
    supportedCaseCount:
      (measured.edges.caseCount as number) - (measured.edges.unsupportedCaseCount as number),
    missedSupportedEdgeCount: measured.edges.missedSupportedEdgeCount,
    accuracy: measured.edges.accuracy,
  });
  assert.deepEqual(committed.probabilityCalibration, measured.probabilityCalibration);
  assert.deepEqual(committed.inputs, {
    originalBlindIdentityAndEdgesFileByteSha256: verified.integrity.originalBlindFileByteSha256,
    currentBlindIdentityAndEdgesFileByteSha256: digest(casesRaw),
    blindIdentityAndEdgesCanonicalJsonSha256: verified.integrity.blindCanonicalJsonSha256,
    frozenPredictionsSha256: digest(predictionsRaw),
    independentGoldSha256: digest(goldRaw),
    bindingStatus: verified.integrity.bindingStatus,
  });
  assert.equal(
    committed.rawArtifact.location,
    'packages/testing/src/gold-corpus/artifacts/evidence-retrieval-index-mechanics.json',
  );
  assert.equal(
    committed.rawArtifact.sha256,
    digest(artifactRaw('evidence-retrieval-index-mechanics.json')),
  );
});

test('committed provider pilot binds scoped retrieval and categorical acceptance evidence', () => {
  const rawArtifact = artifactRaw('evidence-retrieval-pilot-2026-09-18.json');
  const artifact = JSON.parse(rawArtifact) as {
    inputProvenance: {
      blind: { fileByteSha256: string };
      gold: { fileByteSha256: string };
      entailmentPredictions: { fileByteSha256: string };
      heldoutIdentityAndEdges: Record<
        'cases' | 'predictions' | 'gold' | 'freezeManifest',
        { fileByteSha256: string }
      >;
    };
    execution: {
      controlledHnswMechanics: {
        semanticSourceScope: string;
        forcedIndexMechanicsPreflight: { hnswIndexUsed: boolean };
      };
    };
    cost: {
      providerCalls: number;
      budgetGate: { passed: boolean };
    };
    lexical: {
      meanRecallAt5: number;
      forbiddenResultRateAt5: number;
      qualityAdmission: string;
    };
    exactVector: {
      meanRecallAt5: number;
      forbiddenResultRateAt5: number;
      qualityAdmission: string;
    };
    approximateAgainstExact: {
      identicalSourceDocumentTopKRateAfterFusion: number;
      nonemptyBaselineQueryCount: number;
    };
    heldoutIdentityAndEdges: {
      identity: { distinctCaseCount: number; falseMergeCount: number };
      edges: { unsupportedCaseCount: number; unsupportedAssertionCount: number };
      probabilityCalibration: { probabilityClaimSupported: boolean };
    };
    uncertainty: { probabilityClaimSupported: boolean };
    cleanup: { status: string; remainingRows: Record<string, number> };
  };

  assert.deepEqual(artifact.inputProvenance, {
    blind: {
      path: 'packages/testing/src/gold-corpus/fixtures/heldout-evidence-retrieval-corpus.v1.json',
      fileByteSha256: digest(fixtureRaw('heldout-evidence-retrieval-corpus.v1.json')),
    },
    gold: {
      path: 'packages/testing/src/gold-corpus/fixtures/heldout-evidence-retrieval-gold.v1.json',
      fileByteSha256: digest(fixtureRaw('heldout-evidence-retrieval-gold.v1.json')),
    },
    entailmentPredictions: {
      path: 'packages/testing/src/gold-corpus/fixtures/heldout-entailment-predictions.v1.json',
      fileByteSha256: digest(fixtureRaw('heldout-entailment-predictions.v1.json')),
      canonicalJsonSha256: digest(
        JSON.stringify(JSON.parse(fixtureRaw('heldout-entailment-predictions.v1.json'))),
      ),
    },
    heldoutIdentityAndEdges: {
      cases: {
        path: 'packages/testing/src/gold-corpus/fixtures/heldout-identity-edge-corpus.v1.json',
        fileByteSha256: digest(fixtureRaw('heldout-identity-edge-corpus.v1.json')),
      },
      predictions: {
        path: 'packages/testing/src/gold-corpus/fixtures/heldout-identity-edge-predictions.v1.json',
        fileByteSha256: digest(fixtureRaw('heldout-identity-edge-predictions.v1.json')),
      },
      gold: {
        path: 'packages/testing/src/gold-corpus/fixtures/heldout-identity-edge-gold.v1.json',
        fileByteSha256: digest(fixtureRaw('heldout-identity-edge-gold.v1.json')),
      },
      freezeManifest: {
        path: 'packages/testing/src/gold-corpus/fixtures/heldout-identity-edge-freeze.v1.json',
        fileByteSha256: digest(fixtureRaw('heldout-identity-edge-freeze.v1.json')),
      },
    },
  });
  assert.equal(
    artifact.execution.controlledHnswMechanics.semanticSourceScope,
    'Held-out document source items only.',
  );
  assert.equal(
    artifact.execution.controlledHnswMechanics.forcedIndexMechanicsPreflight.hnswIndexUsed,
    true,
  );
  assert.deepEqual(
    {
      providerCalls: artifact.cost.providerCalls,
      budgetPassed: artifact.cost.budgetGate.passed,
      lexicalRecallAt5: artifact.lexical.meanRecallAt5,
      exactRecallAt5: artifact.exactVector.meanRecallAt5,
      lexicalForbiddenCandidateRateAt5: artifact.lexical.forbiddenResultRateAt5,
      exactForbiddenCandidateRateAt5: artifact.exactVector.forbiddenResultRateAt5,
      exactQualityAdmission: artifact.exactVector.qualityAdmission,
      exactApproximateTopKAgreement:
        artifact.approximateAgainstExact.identicalSourceDocumentTopKRateAfterFusion,
      nonemptyExactBaselineQueries: artifact.approximateAgainstExact.nonemptyBaselineQueryCount,
      distinctIdentityCases: artifact.heldoutIdentityAndEdges.identity.distinctCaseCount,
      falseMerges: artifact.heldoutIdentityAndEdges.identity.falseMergeCount,
      unsupportedEdgeCases: artifact.heldoutIdentityAndEdges.edges.unsupportedCaseCount,
      unsupportedAssertions: artifact.heldoutIdentityAndEdges.edges.unsupportedAssertionCount,
      categoricalProbabilityClaim:
        artifact.heldoutIdentityAndEdges.probabilityCalibration.probabilityClaimSupported,
      retrievalProbabilityClaim: artifact.uncertainty.probabilityClaimSupported,
    },
    {
      providerCalls: 1,
      budgetPassed: true,
      lexicalRecallAt5: 0.45,
      exactRecallAt5: 1,
      lexicalForbiddenCandidateRateAt5: 0.1,
      exactForbiddenCandidateRateAt5: 0.55,
      exactQualityAdmission: 'not_evaluated',
      exactApproximateTopKAgreement: 1,
      nonemptyExactBaselineQueries: 20,
      distinctIdentityCases: 4,
      falseMerges: 0,
      unsupportedEdgeCases: 5,
      unsupportedAssertions: 0,
      categoricalProbabilityClaim: false,
      retrievalProbabilityClaim: false,
    },
  );
  assert.equal(artifact.lexical.qualityAdmission, 'not_evaluated');
  assert.equal(artifact.cleanup.status, 'completed');
  assert.ok(Object.values(artifact.cleanup.remainingRows).every((count) => count === 0));
  assert.doesNotMatch(
    rawArtifact,
    /'\[[0-9eE+.,\-\s]{100,}\]'::(?:extensions\.)?vector/u,
    'public EXPLAIN plans must not contain raw embedding arrays',
  );
  assert.match(rawArtifact, /<redacted-vector>/u);
  assert.match(rawArtifact, /retrieval_passages_vector_idx/u);
  assert.match(rawArtifact, /<=>/u);
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
