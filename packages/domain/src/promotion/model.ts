/**
 * Domain contracts for the controlled claim-promotion pipeline.
 */
import type { ClaimClass } from '@repo/schemas';

export const PROMOTION_STAGES = [
  'submission_discovery',
  'research_case',
  'proposed_claim',
  'accepted_claim',
  'publication_candidate',
  'release',
] as const;

export type PromotionStage = (typeof PROMOTION_STAGES)[number];

export const PROMOTION_STAGE_TRANSITIONS: Readonly<Record<PromotionStage, PromotionStage | null>> =
  {
    submission_discovery: 'research_case',
    research_case: 'proposed_claim',
    proposed_claim: 'accepted_claim',
    accepted_claim: 'publication_candidate',
    publication_candidate: 'release',
    release: null,
  };

export type SourceReputation = 'blocked' | 'unknown' | 'limited' | 'established' | 'authoritative';
export type EvidenceRole = 'supporting' | 'contradicting' | 'contextual';

export type PromotionEvidence = {
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly sourceOrganizationId: string;
  readonly lineageRootId: string;
  readonly independenceGroupId: string;
  readonly role: EvidenceRole;
  readonly credible: boolean;
  readonly reputation: SourceReputation;
  readonly quality: number;
  readonly contentFingerprint: string;
  readonly coordinatedGroupId?: string;
  readonly sourceSubjectEntityIds?: readonly string[];
};

export type ContradictionSearch = {
  readonly completed: boolean;
  readonly searchedAt?: string;
  readonly querySummary?: string;
  readonly reviewerId?: string;
};

export type PromotionClaim = {
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly entityId: string;
  readonly claimClass: ClaimClass;
  readonly confidence: number;
  readonly proposerId: string;
  readonly evidence: readonly PromotionEvidence[];
  readonly contradictionSearch: ContradictionSearch;
};

export type PromotionRecord = {
  readonly id: string;
  readonly stage: PromotionStage;
  readonly submissionOrDiscoveryId: string;
  readonly researchCaseId?: string;
  readonly claimId?: string;
  readonly releaseCandidateId?: string;
  readonly releaseId?: string;
  readonly updatedAt: string;
};

export type ReviewQueue = 'critical' | 'elevated' | 'standard';

export type PromotionPolicy = {
  readonly policyVersion: string;
  readonly minimumReputation: Exclude<SourceReputation, 'blocked'>;
  readonly standardMinimumIndependentLineages: number;
  readonly highImpactMinimumIndependentLineages: number;
  readonly highImpactMinimumStrongLineages: number;
  readonly standardConfidenceThreshold: number;
  readonly highImpactConfidenceThreshold: number;
  readonly strongReputations: readonly SourceReputation[];
};

export const DEFAULT_PROMOTION_POLICY: PromotionPolicy = Object.freeze({
  policyVersion: '1.0.0',
  minimumReputation: 'limited',
  standardMinimumIndependentLineages: 2,
  highImpactMinimumIndependentLineages: 3,
  highImpactMinimumStrongLineages: 2,
  standardConfidenceThreshold: 0.7,
  highImpactConfidenceThreshold: 0.85,
  strongReputations: Object.freeze(['established', 'authoritative'] as const),
});

export type PromotionGateReason =
  | 'invalid_confidence'
  | 'contradiction_search_incomplete'
  | 'insufficient_independent_lineages'
  | 'insufficient_strong_evidence'
  | 'blocked_source'
  | 'source_reputation_too_low'
  | 'self_approval_by_repetition'
  | 'credible_contradiction_unresolved'
  | 'confidence_below_threshold'
  | 'proposer_approver_conflict';

export type PromotionGateResult = {
  readonly approved: boolean;
  readonly deterministic: true;
  readonly policyVersion: string;
  readonly queue: ReviewQueue;
  readonly reasons: readonly PromotionGateReason[];
  readonly independentLineageCount: number;
  readonly strongIndependentLineageCount: number;
  readonly rawSupportingEvidenceCount: number;
  readonly confidenceThreshold: number;
  readonly contributingEvidenceIds: readonly string[];
};
