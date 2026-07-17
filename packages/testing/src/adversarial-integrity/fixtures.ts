
/**
 * Deterministic fixtures shared by adversarial integrity scenario runners.
 */
import type { ClaimEvidenceLink } from '@black-book/domain';
import type { PromotionClaim, PromotionEvidence } from '@black-book/domain';
import type { SubmissionIntakeContext } from '@black-book/security';

export const BASE_NOW_MS = Date.parse('2026-07-17T04:00:00.000Z');
export const BASE_NOW_ISO = '2026-07-17T04:00:00.000Z';

export function submissionContext(
  overrides: Partial<SubmissionIntakeContext> = {},
): SubmissionIntakeContext {
  return {
    receivedAtMs: BASE_NOW_MS,
    privacyPepper: 'bb060-test-pepper-do-not-use-in-prod',
    ...overrides,
  };
}

export function promotionEvidence(
  id: string,
  lineageRootId: string,
  overrides: Partial<PromotionEvidence> = {},
): PromotionEvidence {
  return {
    evidenceId: id,
    sourceId: `source-${id}`,
    sourceOrganizationId: `organization-${id}`,
    lineageRootId,
    independenceGroupId: `independent-${lineageRootId}`,
    role: 'supporting',
    credible: true,
    reputation: 'authoritative',
    quality: 0.9,
    contentFingerprint: `fingerprint-${id}`,
    ...overrides,
  };
}

export function promotionClaim(overrides: Partial<PromotionClaim> = {}): PromotionClaim {
  return {
    claimId: 'claim-bb060',
    claimVersionId: 'claim-bb060-v1',
    entityId: 'entity-bb060',
    claimClass: 'standard',
    confidence: 0.9,
    proposerId: 'researcher-bb060',
    evidence: [promotionEvidence('one', 'lineage-one'), promotionEvidence('two', 'lineage-two')],
    contradictionSearch: {
      completed: true,
      searchedAt: BASE_NOW_ISO,
      querySummary: 'Searched registered sources for contradictory values.',
      reviewerId: 'researcher-peer',
    },
    ...overrides,
  };
}

export function claimEvidenceLink(
  id: string,
  lineageRootId: string,
  overrides: Partial<ClaimEvidenceLink> = {},
): ClaimEvidenceLink {
  return {
    id: `link_${id}`,
    claimId: 'claim_bb060',
    claimVersionId: 'claim_bb060_v1',
    evidenceId: id,
    role: 'supporting',
    lineageRootId,
    credible: true,
    sourceClassification: 'reputable_secondary',
    directness: 0.7875,
    temporalProximity: 0.7875,
    geographicPrecision: 0.7875,
    entityMatchQuality: 0.7875,
    extractionQuality: 0.7875,
    createdAt: BASE_NOW_ISO,
    ...overrides,
  };
}
