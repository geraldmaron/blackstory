/**
 * Deterministic lineage, reputation, corroboration, review, and approval controls (BB-032).
 */
import {
  DEFAULT_PROMOTION_POLICY,
  PROMOTION_STAGE_TRANSITIONS,
  type PromotionClaim,
  type PromotionEvidence,
  type PromotionGateReason,
  type PromotionGateResult,
  type PromotionPolicy,
  type PromotionRecord,
  type PromotionStage,
  type ReviewQueue,
  type SourceReputation,
} from './model.js';

const REPUTATION_RANK: Readonly<Record<SourceReputation, number>> = {
  blocked: -1,
  unknown: 0,
  limited: 1,
  established: 2,
  authoritative: 3,
};

export type EvidenceDetection = {
  readonly duplicateEvidenceIds: readonly string[];
  readonly coordinatedEvidenceIds: readonly string[];
  readonly independentEvidence: readonly PromotionEvidence[];
};

function assertUnitInterval(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} must be between 0 and 1`);
  }
}

function evidenceRank(evidence: PromotionEvidence): number {
  return REPUTATION_RANK[evidence.reputation] * 2 + evidence.quality;
}

function independenceKey(evidence: PromotionEvidence): string {
  return evidence.coordinatedGroupId
    ? `coordinated:${evidence.coordinatedGroupId}`
    : `independent:${evidence.independenceGroupId}`;
}

export function detectDuplicateAndCoordinatedEvidence(
  evidence: readonly PromotionEvidence[],
): EvidenceDetection {
  const duplicateEvidenceIds: string[] = [];
  const coordinatedEvidenceIds: string[] = [];
  const seenFingerprints = new Set<string>();
  const coordinatedCounts = new Map<string, number>();
  const byLineage = new Map<string, PromotionEvidence>();

  for (const item of evidence) {
    assertUnitInterval(item.quality, `evidence ${item.evidenceId} quality`);
    if (seenFingerprints.has(item.contentFingerprint)) {
      duplicateEvidenceIds.push(item.evidenceId);
    } else {
      seenFingerprints.add(item.contentFingerprint);
    }
    if (item.coordinatedGroupId) {
      coordinatedCounts.set(
        item.coordinatedGroupId,
        (coordinatedCounts.get(item.coordinatedGroupId) ?? 0) + 1,
      );
    }

    const key = `${item.lineageRootId}\u0000${item.role}`;
    const current = byLineage.get(key);
    if (!current || evidenceRank(item) > evidenceRank(current)) {
      byLineage.set(key, item);
    }
  }

  for (const item of evidence) {
    if (
      item.coordinatedGroupId &&
      (coordinatedCounts.get(item.coordinatedGroupId) ?? 0) > 1
    ) {
      coordinatedEvidenceIds.push(item.evidenceId);
    }
  }

  return Object.freeze({
    duplicateEvidenceIds: Object.freeze(duplicateEvidenceIds.sort()),
    coordinatedEvidenceIds: Object.freeze(coordinatedEvidenceIds.sort()),
    independentEvidence: Object.freeze(
      [...byLineage.values()].sort(
        (left, right) =>
          left.lineageRootId.localeCompare(right.lineageRootId) ||
          left.evidenceId.localeCompare(right.evidenceId),
      ),
    ),
  });
}

export function collapseSupportingEvidence(
  evidence: readonly PromotionEvidence[],
): readonly PromotionEvidence[] {
  const eligible = detectDuplicateAndCoordinatedEvidence(evidence).independentEvidence.filter(
    (item) => item.role === 'supporting' && item.credible,
  );
  const byFingerprint = new Map<string, PromotionEvidence>();
  for (const item of eligible) {
    const current = byFingerprint.get(item.contentFingerprint);
    if (!current || evidenceRank(item) > evidenceRank(current)) {
      byFingerprint.set(item.contentFingerprint, item);
    }
  }
  const byIndependence = new Map<string, PromotionEvidence>();
  for (const item of byFingerprint.values()) {
    const key = independenceKey(item);
    const current = byIndependence.get(key);
    if (!current || evidenceRank(item) > evidenceRank(current)) {
      byIndependence.set(key, item);
    }
  }
  return Object.freeze(
    [...byIndependence.values()].sort(
      (left, right) =>
        independenceKey(left).localeCompare(independenceKey(right)) ||
        left.evidenceId.localeCompare(right.evidenceId),
    ),
  );
}

export function routePromotionReview(
  claimClass: PromotionClaim['claimClass'],
  confidence: number,
  policy: PromotionPolicy = DEFAULT_PROMOTION_POLICY,
): ReviewQueue {
  assertUnitInterval(confidence, 'confidence');
  const threshold =
    claimClass === 'high_impact'
      ? policy.highImpactConfidenceThreshold
      : policy.standardConfidenceThreshold;
  if (claimClass === 'high_impact' || confidence < threshold) return 'critical';
  if (confidence < threshold + 0.1) return 'elevated';
  return 'standard';
}

export function evaluatePromotionGate(input: {
  readonly claim: PromotionClaim;
  readonly approverId: string;
  readonly policy?: PromotionPolicy;
}): PromotionGateResult {
  const policy = input.policy ?? DEFAULT_PROMOTION_POLICY;
  const reasons = new Set<PromotionGateReason>();
  try {
    assertUnitInterval(input.claim.confidence, 'confidence');
  } catch {
    reasons.add('invalid_confidence');
  }
  if (
    !input.claim.contradictionSearch.completed ||
    !input.claim.contradictionSearch.searchedAt ||
    !input.claim.contradictionSearch.querySummary?.trim()
  ) {
    reasons.add('contradiction_search_incomplete');
  }
  if (!input.approverId.trim() || input.approverId === input.claim.proposerId) {
    reasons.add('proposer_approver_conflict');
  }

  const supporting = collapseSupportingEvidence(input.claim.evidence);
  const minimumLineages =
    input.claim.claimClass === 'high_impact'
      ? policy.highImpactMinimumIndependentLineages
      : policy.standardMinimumIndependentLineages;
  if (supporting.length < minimumLineages) {
    reasons.add('insufficient_independent_lineages');
  }
  if (supporting.some((item) => item.reputation === 'blocked')) {
    reasons.add('blocked_source');
  }
  if (
    supporting.some(
      (item) => REPUTATION_RANK[item.reputation] < REPUTATION_RANK[policy.minimumReputation],
    )
  ) {
    reasons.add('source_reputation_too_low');
  }

  const nonSelfSupporting = supporting.filter(
    (item) => !item.sourceSubjectEntityIds?.includes(input.claim.entityId),
  );
  if (supporting.length > 0 && nonSelfSupporting.length === 0) {
    reasons.add('self_approval_by_repetition');
  }

  const credibleContradiction = detectDuplicateAndCoordinatedEvidence(
    input.claim.evidence,
  ).independentEvidence.some((item) => item.role === 'contradicting' && item.credible);
  if (credibleContradiction) {
    reasons.add('credible_contradiction_unresolved');
  }

  const strongLineages = supporting.filter((item) =>
    policy.strongReputations.includes(item.reputation),
  );
  if (
    input.claim.claimClass === 'high_impact' &&
    strongLineages.length < policy.highImpactMinimumStrongLineages
  ) {
    reasons.add('insufficient_strong_evidence');
  }
  const threshold =
    input.claim.claimClass === 'high_impact'
      ? policy.highImpactConfidenceThreshold
      : policy.standardConfidenceThreshold;
  if (!Number.isFinite(input.claim.confidence) || input.claim.confidence < threshold) {
    reasons.add('confidence_below_threshold');
  }

  return Object.freeze({
    approved: reasons.size === 0,
    deterministic: true,
    policyVersion: policy.policyVersion,
    queue: routePromotionReview(
      input.claim.claimClass,
      Number.isFinite(input.claim.confidence) ? Math.max(0, Math.min(1, input.claim.confidence)) : 0,
      policy,
    ),
    reasons: Object.freeze([...reasons].sort()),
    independentLineageCount: supporting.length,
    strongIndependentLineageCount: strongLineages.length,
    rawSupportingEvidenceCount: input.claim.evidence.filter((item) => item.role === 'supporting')
      .length,
    confidenceThreshold: threshold,
    contributingEvidenceIds: Object.freeze(supporting.map((item) => item.evidenceId)),
  });
}

export function advancePromotionRecord(
  record: PromotionRecord,
  targetStage: PromotionStage,
  input: {
    readonly now: string;
    readonly researchCaseId?: string;
    readonly claimId?: string;
    readonly releaseCandidateId?: string;
    readonly releaseId?: string;
  },
): PromotionRecord {
  if (PROMOTION_STAGE_TRANSITIONS[record.stage] !== targetStage) {
    throw new Error(`Promotion cannot transition from ${record.stage} to ${targetStage}`);
  }
  if (!Number.isFinite(Date.parse(input.now))) {
    throw new Error('now must be an ISO-compatible date');
  }
  const requiredId: Partial<Record<PromotionStage, string | undefined>> = {
    research_case: input.researchCaseId,
    proposed_claim: input.claimId,
    accepted_claim: record.claimId ?? input.claimId,
    publication_candidate: input.releaseCandidateId,
    release: input.releaseId,
  };
  if (targetStage !== 'submission_discovery' && !requiredId[targetStage]?.trim()) {
    throw new Error(`${targetStage} requires its stage identifier`);
  }
  return Object.freeze({
    ...record,
    stage: targetStage,
    updatedAt: input.now,
    ...(input.researchCaseId ? { researchCaseId: input.researchCaseId } : {}),
    ...(input.claimId ? { claimId: input.claimId } : {}),
    ...(input.releaseCandidateId ? { releaseCandidateId: input.releaseCandidateId } : {}),
    ...(input.releaseId ? { releaseId: input.releaseId } : {}),
  });
}
