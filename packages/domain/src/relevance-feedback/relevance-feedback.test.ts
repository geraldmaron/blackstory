/**
 * relevance/confidence feedback-loop calibration layer.
 * Covers decision-log extraction (from real research-case transitions), the
 * recalibration report's four analyses, the weight-change propose/gate/approve boundary (proving
 * the determinism invariant report proposes, humans approve, gold-corpus gates), and the pure
 * drift-alarm evaluator.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as relevanceFeedback from './index.ts';
import {
  buildRelevanceCalibrationDataset,
  computeRelevanceInputFingerprint,
  extractRelevanceDecisionLog,
} from './decision-log.ts';
import {
  analyzeDimensionDisagreement,
  analyzeGraylistYield,
  analyzeQueryPackEffectiveness,
  analyzeSourceTierPrecision,
  buildRecalibrationReport,
} from './recalibration-report.ts';
import {
  approveWeightChange,
  buildRelevanceWeightPolicy,
  currentRelevanceWeightPolicy,
  proposeWeightChange,
  requireGoldCorpusGatePassed,
  type GoldCorpusGateInput,
} from './weight-policy.ts';
import { evaluateRelevanceDriftAlarm } from './drift-alarm.ts';
import { RELEVANCE_DIMENSION_WEIGHTS, RELEVANCE_DIMENSIONS } from '../relevance/index.ts';
import type { RelevanceAssessment, RelevanceFeatureValue } from '../relevance/index.ts';
import {
  createResearchCase,
  transitionResearchCase,
  EVIDENCE_CHECKLIST_KEYS,
  MINIMUM_RECORD_CHECKLIST_KEYS,
  type EvidenceChecklist,
  type ResearchCaseRecord,
} from '../research-case/index.ts';
import {
  buildQueryPack,
  createInMemoryEffectivenessStore,
  recordQueryPackMetric,
} from '../query-packs/index.ts';
import type { DiscoveryCandidateRecord } from '../discovery/index.ts';

const NOW = '2026-07-17T04:00:00.000Z';
const LATER = '2026-07-17T05:00:00.000Z';

function featureValues(overrides: Partial<Record<RelevanceFeatureValue['dimension'], number>> = {}): readonly RelevanceFeatureValue[] {
  const defaults: Record<RelevanceFeatureValue['dimension'], number> = {
    signal_strength: 0.8,
    thematic_alignment: 0.7,
    geographic_connection: 0.6,
    source_authority: 0.9,
    distinctiveness: 1,
  };
  return RELEVANCE_DIMENSIONS.map((dimension) => {
    const value = overrides[dimension] ?? defaults[dimension];
    const weight = RELEVANCE_DIMENSION_WEIGHTS[dimension];
    return {
      dimension,
      value,
      weight,
      contribution: value * weight,
      rationale: `test rationale for ${dimension}`,
    };
  });
}

function assessment(input: {
  readonly candidateId?: string;
  readonly decision?: RelevanceAssessment['decision'];
  readonly compositeScore?: number;
  readonly override?: RelevanceAssessment['override'];
  readonly featureOverrides?: Partial<Record<RelevanceFeatureValue['dimension'], number>>;
} = {}): RelevanceAssessment {
  return {
    schemaVersion: 'relevance-assessment.v1',
    candidateId: input.candidateId ?? 'candidate-1',
    decision: input.decision ?? 'include',
    compositeScore: input.compositeScore ?? 0.82,
    policyVersion: '1.0.0',
    passes: (input.decision ?? 'include') !== 'exclude',
    featureValues: featureValues(input.featureOverrides),
    gates: [],
    evidence: [],
    whyThisAppears: 'The candidate has a directly relevant documented signal.',
    distinctivenessKey: `distinct-${input.candidateId ?? 'candidate-1'}`,
    isDuplicate: false,
    assessedAt: NOW,
    ...(input.override ? { override: input.override } : {}),
  };
}

function caseAtRelevanceReview(caseId: string, candidateId: string): ResearchCaseRecord {
  const created = createResearchCase({
    id: caseId,
    candidateId,
    title: `Case ${caseId}`,
    checklist: { items: [] },
    now: NOW,
  });
  return transitionResearchCase(created, {
    targetState: 'relevance_review',
    actorId: 'researcher-1',
    now: NOW,
    reasonCode: 'new_evidence_received',
    reason: 'Entered relevance review.',
  });
}

function caseWithVerdict(input: {
  readonly caseId: string;
  readonly candidateId: string;
  readonly targetState: 'relevance_confirmed' | 'excluded' | 'insufficient_evidence';
  readonly relevanceAssessment: RelevanceAssessment;
  readonly reasonCode?: Parameters<typeof transitionResearchCase>[1]['reasonCode'];
}): ResearchCaseRecord {
  const reasonCode =
    input.reasonCode ??
    (input.targetState === 'relevance_confirmed' ? 'relevance_confirmed' : 'relevance_not_established');
  return transitionResearchCase(caseAtRelevanceReview(input.caseId, input.candidateId), {
    targetState: input.targetState,
    actorId: 'researcher-1',
    now: LATER,
    reasonCode,
    reason: 'Relevance verdict recorded.',
    relevanceAssessment: input.relevanceAssessment,
  });
}

// --- decision-log.ts -------------------------------------------------------------------------

test('extractRelevanceDecisionLog classifies a matching relevance_confirmed transition as accept', () => {
  const record = caseWithVerdict({
    caseId: 'case-accept',
    candidateId: 'candidate-accept',
    targetState: 'relevance_confirmed',
    relevanceAssessment: assessment({ candidateId: 'candidate-accept', decision: 'include' }),
  });
  const [entry] = extractRelevanceDecisionLog([record]);
  assert.ok(entry);
  assert.equal(entry.disposition, 'accept');
  assert.equal(entry.overrideApplied, false);
  assert.equal(entry.to, 'relevance_confirmed');
});

test('extractRelevanceDecisionLog classifies excluding an engine-includable candidate as reject', () => {
  const record = caseWithVerdict({
    caseId: 'case-reject',
    candidateId: 'candidate-reject',
    targetState: 'excluded',
    relevanceAssessment: assessment({ candidateId: 'candidate-reject', decision: 'include' }),
  });
  const [entry] = extractRelevanceDecisionLog([record]);
  assert.ok(entry);
  assert.equal(entry.disposition, 'reject');
});

test('extractRelevanceDecisionLog classifies excluding an engine-exclude candidate as accept', () => {
  const record = caseWithVerdict({
    caseId: 'case-agree-exclude',
    candidateId: 'candidate-agree-exclude',
    targetState: 'excluded',
    relevanceAssessment: assessment({ candidateId: 'candidate-agree-exclude', decision: 'exclude', compositeScore: 0.1 }),
  });
  const [entry] = extractRelevanceDecisionLog([record]);
  assert.ok(entry);
  assert.equal(entry.disposition, 'accept');
});

test('extractRelevanceDecisionLog classifies a formal override as override regardless of engine decision', () => {
  const record = caseWithVerdict({
    caseId: 'case-override',
    candidateId: 'candidate-override',
    targetState: 'relevance_confirmed',
    relevanceAssessment: assessment({
      candidateId: 'candidate-override',
      decision: 'include',
      override: {
        decision: 'include',
        reason: 'Researcher confirmed relevance from primary-source review.',
        overriddenBy: 'researcher-1',
        overriddenAt: LATER,
      },
    }),
  });
  const [entry] = extractRelevanceDecisionLog([record]);
  assert.ok(entry);
  assert.equal(entry.disposition, 'override');
  assert.equal(entry.overrideApplied, true);
  assert.equal(entry.overrideReason, 'Researcher confirmed relevance from primary-source review.');
});

function minimumChecklist(): EvidenceChecklist {
  const minimumSet = new Set<string>(MINIMUM_RECORD_CHECKLIST_KEYS);
  return {
    items: EVIDENCE_CHECKLIST_KEYS.map((key) => ({
      key,
      complete: minimumSet.has(key),
      evidenceIds: minimumSet.has(key) ? [`evidence-${key}`] : [],
    })),
  };
}

test('extractRelevanceDecisionLog skips snapshots with no relevance verdict and snapshots with no relevanceAssessment', () => {
  const reviewOnly = caseAtRelevanceReview('case-in-review', 'candidate-in-review');
  const confirmed = caseWithVerdict({
    caseId: 'case-progressed',
    candidateId: 'candidate-progressed',
    targetState: 'relevance_confirmed',
    relevanceAssessment: assessment({ candidateId: 'candidate-progressed' }),
  });
  const progressedFurther = transitionResearchCase(confirmed, {
    targetState: 'minimum_record',
    actorId: 'researcher-1',
    now: LATER,
    reasonCode: 'minimum_record_complete',
    reason: 'Minimum record complete.',
    checklist: minimumChecklist(),
  });
  const entries = extractRelevanceDecisionLog([reviewOnly, progressedFurther]);
  assert.deepEqual(entries, []);
});

test('computeRelevanceInputFingerprint is deterministic and changes when inputs change', () => {
  const base = {
    candidateId: 'candidate-1',
    featureValues: featureValues(),
    policyVersion: '1.0.0',
    compositeScore: 0.82,
  };
  const again = computeRelevanceInputFingerprint(base);
  assert.equal(computeRelevanceInputFingerprint(base), again);
  assert.notEqual(computeRelevanceInputFingerprint({ ...base, compositeScore: 0.5 }), again);
  assert.match(again, /^sha256:[0-9a-f]{64}$/);
});

test('extractRelevanceDecisionLog enriches entries with adapterId/sourceTier only when candidatesById is supplied', () => {
  const record = caseWithVerdict({
    caseId: 'case-enriched',
    candidateId: 'candidate-enriched',
    targetState: 'relevance_confirmed',
    relevanceAssessment: assessment({ candidateId: 'candidate-enriched' }),
  });

  const withoutEnrichment = extractRelevanceDecisionLog([record]);
  assert.equal(withoutEnrichment[0]?.adapterId, undefined);

  const discoveryCandidate = {
    identity: { sourceReferences: [{ adapterId: 'wikimedia' }] },
    adapterRecord: { classification: 'government_record' },
  } as unknown as DiscoveryCandidateRecord;
  const candidatesById = new Map([['candidate-enriched', discoveryCandidate]]);
  const [enriched] = extractRelevanceDecisionLog([record], { candidatesById });
  assert.equal(enriched?.adapterId, 'wikimedia');
  assert.equal(enriched?.sourceTier, 'government_record');
});

test('buildRelevanceCalibrationDataset sorts entries deterministically by caseId then transitionIndex', () => {
  const recordB = caseWithVerdict({
    caseId: 'case-b',
    candidateId: 'candidate-b',
    targetState: 'relevance_confirmed',
    relevanceAssessment: assessment({ candidateId: 'candidate-b' }),
  });
  const recordA = caseWithVerdict({
    caseId: 'case-a',
    candidateId: 'candidate-a',
    targetState: 'relevance_confirmed',
    relevanceAssessment: assessment({ candidateId: 'candidate-a' }),
  });
  const dataset = buildRelevanceCalibrationDataset({
    entries: extractRelevanceDecisionLog([recordB, recordA]),
    extractedAt: NOW,
  });
  assert.deepEqual(dataset.entries.map((entry) => entry.caseId), ['case-a', 'case-b']);
});

// --- recalibration-report.ts ------------------------------------------------------------------

test('analyzeDimensionDisagreement ranks dimensions by divergence between agreement and disagreement cases', () => {
  const accepted = caseWithVerdict({
    caseId: 'case-dim-accept',
    candidateId: 'candidate-dim-accept',
    targetState: 'relevance_confirmed',
    relevanceAssessment: assessment({
      candidateId: 'candidate-dim-accept',
      featureOverrides: { source_authority: 0.95 },
    }),
  });
  const rejected = caseWithVerdict({
    caseId: 'case-dim-reject',
    candidateId: 'candidate-dim-reject',
    targetState: 'excluded',
    relevanceAssessment: assessment({
      candidateId: 'candidate-dim-reject',
      decision: 'include',
      featureOverrides: { source_authority: 0.1 },
    }),
  });
  const entries = extractRelevanceDecisionLog([accepted, rejected]);
  assert.equal(entries.length, 2);
  const summary = analyzeDimensionDisagreement(entries);
  assert.equal(summary.length, RELEVANCE_DIMENSIONS.length);
  // source_authority has the largest engineered gap (0.95 vs 0.1) so it should rank first.
  assert.equal(summary[0]?.dimension, 'source_authority');
  assert.ok(summary[0]!.divergence >= summary[1]!.divergence);
});

test('analyzeQueryPackEffectiveness reuses  computeEffectivenessMetrics and ranks noisiest packs first', () => {
  const pack = buildQueryPack({
    id: 'pack-1',
    displayName: 'Test pack',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    terms: [{ text: 'test term', termClass: 'positive' }],
    createdAt: NOW,
  });
  const store = createInMemoryEffectivenessStore();
  recordQueryPackMetric(store, {
    packId: pack.id,
    versionId: pack.versionId,
    runId: 'run-1',
    recordedAt: NOW,
    queriesExecuted: 100,
    matchesObserved: 40,
    exclusionsObserved: 5,
    falsePositiveObserved: 20,
  });
  const results = analyzeQueryPackEffectiveness({
    records: store.records,
    packs: [{ packId: pack.id, versionId: pack.versionId }],
  });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.packId, pack.id);
  assert.equal(results[0]?.totalQueries, 100);
});

test('analyzeGraylistYield reports unavailable when no input is supplied ( gap) and computes yield when it is', () => {
  const unavailable = analyzeGraylistYield();
  assert.equal(unavailable.available, false);

  const available = analyzeGraylistYield([
    { parkedSignalId: 'p1', parkedAt: NOW, corroboratedAt: LATER },
    { parkedSignalId: 'p2', parkedAt: NOW },
  ]);
  assert.deepEqual(available, { available: true, parkedCount: 2, corroboratedCount: 1, yieldRate: 0.5 });
});

test('analyzeSourceTierPrecision groups by adapter+tier and excludes unenriched entries', () => {
  const discoveryCandidate = {
    identity: { sourceReferences: [{ adapterId: 'loc' }] },
    adapterRecord: { classification: 'primary_archival' },
  } as unknown as DiscoveryCandidateRecord;
  const accepted = caseWithVerdict({
    caseId: 'case-tier-accept',
    candidateId: 'candidate-tier-1',
    targetState: 'relevance_confirmed',
    relevanceAssessment: assessment({ candidateId: 'candidate-tier-1' }),
  });
  const rejected = caseWithVerdict({
    caseId: 'case-tier-reject',
    candidateId: 'candidate-tier-2',
    targetState: 'excluded',
    relevanceAssessment: assessment({ candidateId: 'candidate-tier-2', decision: 'include' }),
  });
  const candidatesById = new Map([
    ['candidate-tier-1', discoveryCandidate],
    ['candidate-tier-2', discoveryCandidate],
  ]);
  const entries = extractRelevanceDecisionLog([accepted, rejected], { candidatesById });
  const summary = analyzeSourceTierPrecision(entries);
  assert.equal(summary.length, 1);
  assert.equal(summary[0]?.adapterId, 'loc');
  assert.equal(summary[0]?.sampleSize, 2);
  assert.equal(summary[0]?.acceptedCount, 1);
  assert.equal(summary[0]?.precision, 0.5);
});

test('buildRecalibrationReport composes every analysis and an overall disagreement rate', () => {
  const accepted = caseWithVerdict({
    caseId: 'case-report-accept',
    candidateId: 'candidate-report-accept',
    targetState: 'relevance_confirmed',
    relevanceAssessment: assessment({ candidateId: 'candidate-report-accept' }),
  });
  const rejected = caseWithVerdict({
    caseId: 'case-report-reject',
    candidateId: 'candidate-report-reject',
    targetState: 'excluded',
    relevanceAssessment: assessment({ candidateId: 'candidate-report-reject', decision: 'include' }),
  });
  const entries = extractRelevanceDecisionLog([accepted, rejected]);
  const report = buildRecalibrationReport({ generatedAt: NOW, decisionLog: entries });
  assert.equal(report.sampleSize, 2);
  assert.equal(report.overallDisagreementRate, 0.5);
  assert.equal(report.dimensionDisagreement.length, RELEVANCE_DIMENSIONS.length);
  assert.equal(report.graylistYield.available, false);
});

// --- weight-policy.ts -------------------------------------------------------------------------

const PASSING_GATE: GoldCorpusGateInput = {
  corpusVersion: 'gold-v1',
  algorithmVersion: 'relevance-weights-v1.1.0',
  passed: true,
  failures: [],
};

const FAILING_GATE: GoldCorpusGateInput = {
  corpusVersion: 'gold-v1',
  algorithmVersion: 'relevance-weights-v1.1.0',
  passed: false,
  failures: ['precision_below_minimum'],
};

function candidateWeights(): Record<(typeof RELEVANCE_DIMENSIONS)[number], number> {
  return {
    signal_strength: 0.3,
    thematic_alignment: 0.3,
    geographic_connection: 0.2,
    source_authority: 0.15,
    distinctiveness: 0.05,
  };
}

test('buildRelevanceWeightPolicy rejects weights that do not sum to 1', () => {
  assert.throws(() =>
    buildRelevanceWeightPolicy({
      policyVersion: '1.1.0',
      weights: { ...candidateWeights(), distinctiveness: 0.5 },
      createdAt: NOW,
    }),
  );
});

test('proposeWeightChange refuses a proposal identical to the current policy', () => {
  const current = currentRelevanceWeightPolicy({ policyVersion: '1.0.0', createdAt: NOW });
  const identical = buildRelevanceWeightPolicy({
    policyVersion: '1.0.0',
    weights: RELEVANCE_DIMENSION_WEIGHTS,
    createdAt: NOW,
  });
  assert.throws(() =>
    proposeWeightChange({
      proposedBy: 'system:recalibration-report',
      proposedAt: NOW,
      rationale: 'no-op',
      currentPolicy: current,
      candidatePolicy: identical,
      sourceReportGeneratedAt: NOW,
    }),
  );
});

test('approveWeightChange refuses same-identity proposer and approver (proposer != approver)', () => {
  const current = currentRelevanceWeightPolicy({ policyVersion: '1.0.0', createdAt: NOW });
  const candidate = buildRelevanceWeightPolicy({ policyVersion: '1.1.0', weights: candidateWeights(), createdAt: NOW });
  const proposal = proposeWeightChange({
    proposedBy: 'system:recalibration-report',
    proposedAt: NOW,
    rationale: 'source_authority divergence exceeds review threshold',
    currentPolicy: current,
    candidatePolicy: candidate,
    sourceReportGeneratedAt: NOW,
  });
  assert.throws(
    () =>
      approveWeightChange({
        proposal,
        approvedBy: 'system:recalibration-report',
        approvedAt: LATER,
        goldCorpusGate: PASSING_GATE,
      }),
    /proposer/i,
  );
});

test('approveWeightChange refuses a proposal that fails the gold-corpus gate', () => {
  const current = currentRelevanceWeightPolicy({ policyVersion: '1.0.0', createdAt: NOW });
  const candidate = buildRelevanceWeightPolicy({ policyVersion: '1.1.0', weights: candidateWeights(), createdAt: NOW });
  const proposal = proposeWeightChange({
    proposedBy: 'system:recalibration-report',
    proposedAt: NOW,
    rationale: 'source_authority divergence exceeds review threshold',
    currentPolicy: current,
    candidatePolicy: candidate,
    sourceReportGeneratedAt: NOW,
  });
  assert.throws(() => requireGoldCorpusGatePassed({ proposal, gate: FAILING_GATE }), /gold-corpus gate/i);
  assert.throws(
    () =>
      approveWeightChange({
        proposal,
        approvedBy: 'human-approver-1',
        approvedAt: LATER,
        goldCorpusGate: FAILING_GATE,
      }),
    /gold-corpus gate/i,
  );
});

test('approveWeightChange succeeds with a distinct human approver and a passing gate, and never mutates the live engine weights', () => {
  const liveWeightsBefore = { ...RELEVANCE_DIMENSION_WEIGHTS };
  const current = currentRelevanceWeightPolicy({ policyVersion: '1.0.0', createdAt: NOW });
  const candidate = buildRelevanceWeightPolicy({ policyVersion: '1.1.0', weights: candidateWeights(), createdAt: NOW });
  const proposal = proposeWeightChange({
    proposedBy: 'system:recalibration-report',
    proposedAt: NOW,
    rationale: 'source_authority divergence exceeds review threshold',
    currentPolicy: current,
    candidatePolicy: candidate,
    sourceReportGeneratedAt: NOW,
  });
  const approval = approveWeightChange({
    proposal,
    approvedBy: 'human-approver-1',
    approvedAt: LATER,
    goldCorpusGate: PASSING_GATE,
  });
  assert.equal(approval.approvedBy, 'human-approver-1');
  assert.deepEqual(approval.activatedPolicy.weights, candidateWeights());
  // The point of the whole boundary: approving a proposal produces a data record only. The live
  // constant the relevance engine actually reads from (../relevance/dimensions.js) is untouched.
  assert.deepEqual(RELEVANCE_DIMENSION_WEIGHTS, liveWeightsBefore);
});

test('this module exports no function capable of applying, activating, or writing a weight change by itself', () => {
  const forbidden = /^(mutate|apply|activate|write|set|commit|persist)/iu;
  const offending = Object.entries(relevanceFeedback)
    .filter(([, value]) => typeof value === 'function')
    .map(([name]) => name)
    .filter((name) => forbidden.test(name));
  assert.deepEqual(offending, []);
});

// --- drift-alarm.ts ---------------------------------------------------------------------------

let driftEntrySequence = 0;

/** 'accept' -> confirmed relevant, engine agreed (decision 'include'); 'reject' -> excluded an
 * engine-includable candidate, no formal override both are legal state transitions, mirroring
 * the already-verified accept/reject fixtures above. Every entry's occurredAt is LATER (fixed
 * by caseWithVerdict), which the window tests below account for explicitly. */
function driftEntry(disposition: 'accept' | 'reject'): ResearchCaseRecord {
  driftEntrySequence += 1;
  const id = `drift-${driftEntrySequence}-${disposition}`;
  return caseWithVerdict({
    caseId: `case-${id}`,
    candidateId: `candidate-${id}`,
    targetState: disposition === 'accept' ? 'relevance_confirmed' : 'excluded',
    relevanceAssessment: assessment({
      candidateId: `candidate-${id}`,
      decision: 'include',
      compositeScore: 0.75,
    }),
  });
}

test('evaluateRelevanceDriftAlarm does not trigger below the minimum sample size regardless of rate', () => {
  const entries = extractRelevanceDecisionLog([driftEntry('reject')]);
  const evaluation = evaluateRelevanceDriftAlarm({
    entries,
    window: { start: NOW, end: '2026-07-18T00:00:00.000Z' },
    thresholds: { disagreementRateThreshold: 0.1, minimumSampleSize: 5 },
  });
  assert.equal(evaluation.triggered, false);
  assert.equal(evaluation.sampleSize, 1);
});

test('evaluateRelevanceDriftAlarm triggers once disagreement rate exceeds threshold with enough samples', () => {
  const records = [driftEntry('accept'), driftEntry('reject'), driftEntry('reject'), driftEntry('reject')];
  const entries = extractRelevanceDecisionLog(records);
  const evaluation = evaluateRelevanceDriftAlarm({
    entries,
    window: { start: NOW, end: '2026-07-18T00:00:00.000Z' },
    thresholds: { disagreementRateThreshold: 0.5, minimumSampleSize: 4 },
  });
  assert.equal(evaluation.sampleSize, 4);
  assert.equal(evaluation.disagreementCount, 3);
  assert.equal(evaluation.triggered, true);
  assert.match(evaluation.reason, /exceeds threshold/);
});

test('evaluateRelevanceDriftAlarm excludes entries outside the window', () => {
  const records = [driftEntry('reject'), driftEntry('reject')];
  const entries = extractRelevanceDecisionLog(records);
  const evaluation = evaluateRelevanceDriftAlarm({
    entries,
    // Window entirely before every entry's occurredAt (LATER = 2026-07-17T05:00:00.000Z).
    window: { start: '2026-01-01T00:00:00.000Z', end: '2026-01-02T00:00:00.000Z' },
    thresholds: { disagreementRateThreshold: 0.1, minimumSampleSize: 1 },
  });
  assert.equal(evaluation.sampleSize, 0);
  assert.equal(evaluation.triggered, false);
});

test('evaluateRelevanceDriftAlarm rejects an inverted window', () => {
  assert.throws(() =>
    evaluateRelevanceDriftAlarm({
      entries: [],
      window: { start: LATER, end: NOW },
      thresholds: { disagreementRateThreshold: 0.1, minimumSampleSize: 1 },
    }),
  );
});
