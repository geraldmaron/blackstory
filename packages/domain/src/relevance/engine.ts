/**
 * Deterministic relevance engine orchestration (BB-040).
 */
import { evaluateRelevance, loadProductConstitution } from '@black-book/schemas';
import type { ProductConstitution } from '@black-book/schemas';
import { deriveProvisionalDecision } from './decisions.js';
import { composeCompositeScore, extractRelevanceFeatures } from './dimensions.js';
import {
  computeDistinctivenessKey,
  detectDuplicateCandidate,
} from './distinctiveness.js';
import {
  buildRelevanceEvidence,
  hasIncludeEvidence,
  runRelevanceGates,
} from './gates.js';
import { validateRelevanceOverride } from './override.js';
import { buildWhyThisAppears } from './why.js';
import type {
  EvaluateRelevanceInput,
  RelevanceAssessment,
  RelevanceGateResult,
} from './types.js';
import type { DiscoveryCandidateRecord } from '../discovery/types.js';

export type EvaluateRelevanceOptions = EvaluateRelevanceInput & {
  readonly policy?: ProductConstitution;
  readonly candidatesById?: ReadonlyMap<string, DiscoveryCandidateRecord>;
};

function finalizeIncludeEvidenceGate(
  decision: RelevanceAssessment['decision'],
  candidate: EvaluateRelevanceInput['candidate'],
  evidence: ReturnType<typeof buildRelevanceEvidence>,
  gates: readonly RelevanceGateResult[],
): { decision: RelevanceAssessment['decision']; gates: readonly RelevanceGateResult[]; exclusionReason?: string } {
  if (decision !== 'include') {
    return { decision, gates };
  }

  const includeEvidence = hasIncludeEvidence(candidate, evidence);
  const includeGate: RelevanceGateResult = {
    gateId: 'include_evidence',
    passed: includeEvidence,
    reason: includeEvidence
      ? 'Include decision has supporting relevance evidence.'
      : 'Include decision requires documented relevance evidence.',
  };

  const nextGates = [...gates.filter((entry) => entry.gateId !== 'include_evidence'), includeGate];
  if (includeEvidence) {
    return { decision, gates: nextGates };
  }

  return {
    decision: 'supporting_context',
    gates: nextGates,
    exclusionReason: includeGate.reason,
  };
}

/** Evaluate a discovery candidate through deterministic relevance gates and scoring. */
export function evaluateCandidateRelevance(
  input: EvaluateRelevanceOptions,
): RelevanceAssessment {
  const policy = input.policy ?? loadProductConstitution();
  const assessedAt = input.assessedAt ?? new Date().toISOString();
  const existing = input.existingAssessments ?? [];
  const override = input.override ? validateRelevanceOverride(input.override) : undefined;

  const isDuplicate = detectDuplicateCandidate(
    input.candidate,
    existing,
    input.candidatesById,
  );

  const featureValues = extractRelevanceFeatures(input.candidate, isDuplicate);
  const compositeScore = composeCompositeScore(featureValues);

  const preliminaryEvidence = buildRelevanceEvidence(input.candidate, []);
  const preliminaryIncludeEvidence = hasIncludeEvidence(input.candidate, preliminaryEvidence);

  let gates = runRelevanceGates({
    candidate: input.candidate,
    compositeScore,
    isDuplicate,
    hasIncludeEvidence: preliminaryIncludeEvidence,
    policy,
  });

  const provisional = deriveProvisionalDecision({
    candidate: input.candidate,
    compositeScore,
    gates,
    policy,
  });

  let decision = provisional.decision;
  let exclusionReason = provisional.exclusionReason;

  const finalized = finalizeIncludeEvidenceGate(
    decision,
    input.candidate,
    preliminaryEvidence,
    gates,
  );
  decision = finalized.decision;
  gates = finalized.gates;
  exclusionReason = finalized.exclusionReason ?? exclusionReason;

  if (override) {
    decision = override.decision;
    exclusionReason = decision === 'exclude' ? override.reason : undefined;
  }

  const evidence = [...buildRelevanceEvidence(input.candidate, gates)];
  if (override) {
    evidence.push({
      kind: 'override',
      summary: 'Manual relevance override applied.',
      detail: override.reason,
    });
  }

  const whyThisAppears = buildWhyThisAppears({
    candidate: input.candidate,
    decision,
    evidence,
    ...(exclusionReason !== undefined ? { exclusionReason } : {}),
    ...(override !== undefined ? { override } : {}),
  });

  const evaluated = evaluateRelevance(compositeScore, decision, policy);

  return {
    schemaVersion: 'relevance-assessment.v1',
    candidateId: input.candidate.id,
    decision,
    compositeScore,
    policyVersion: evaluated.policyVersion,
    passes: evaluated.passes,
    featureValues,
    gates,
    evidence,
    whyThisAppears,
    ...(exclusionReason !== undefined ? { exclusionReason } : {}),
    ...(override !== undefined ? { override } : {}),
    distinctivenessKey: computeDistinctivenessKey(input.candidate),
    isDuplicate,
    assessedAt,
  };
}

/** Batch-evaluate candidates with distinctiveness context carried forward. */
export function evaluateCandidateRelevanceBatch(
  candidates: readonly EvaluateRelevanceInput['candidate'][],
  options: {
    readonly policy?: ProductConstitution;
    readonly assessedAt?: string;
  } = {},
): readonly RelevanceAssessment[] {
  const assessments: RelevanceAssessment[] = [];
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  for (const candidate of candidates) {
    const assessment = evaluateCandidateRelevance({
      candidate,
      existingAssessments: assessments,
      candidatesById,
      ...(options.policy !== undefined ? { policy: options.policy } : {}),
      ...(options.assessedAt !== undefined ? { assessedAt: options.assessedAt } : {}),
    });
    assessments.push(assessment);
  }

  return assessments;
}
