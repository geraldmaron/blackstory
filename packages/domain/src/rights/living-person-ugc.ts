/**
 * Living-person UGC ethics layer: runtime guards for the constitution's
 * `ugcLivingPersonRules` extension (`packages/schemas/constitution/policy.v1.json`). Extends
 * living-person enforcement above the legal floor, specifically for user-generated and
 * third-party content.
 *
 * Honesty note on "no cross-source aggregation into profiles": this is fundamentally an
 * architectural constraint, not something one function can guarantee end-to-end.
 * `assertNoCrossSourceProfileAggregation` mechanically rejects aggregation *that is routed
 * through it* — any write path that bypasses this function is invisible to it. The remaining
 * surface (making sure every profile-field write actually calls this guard) is a documented
 * policy constraint enforced by code review.
 */
import {
  evaluateClaimConfidence,
  evaluateLivingStatus,
  loadProductConstitution,
  type ProductConstitution,
} from '@repo/schemas';

export type PersonalDetailContribution = {
  readonly field: string;
  readonly sourceId: string;
  readonly evidenceId: string;
};

/**
 * Mechanically-enforceable guard: rejects merging the same living-person personal-detail
 * field from more than one distinct source into a single profile write. Every profile-field
 * write must be routed through this function for the guarantee to hold (see module doc).
 */
export function assertNoCrossSourceProfileAggregation(
  livingStatus: string,
  contributions: readonly PersonalDetailContribution[],
  policy: ProductConstitution = loadProductConstitution(),
): void {
  if (!policy.ugcLivingPersonRules.crossSourceProfileAggregationProhibited) {
    return;
  }
  if (!evaluateLivingStatus(livingStatus, policy).treatAsLiving) {
    return;
  }

  const sourcesByField = new Map<string, Set<string>>();
  for (const contribution of contributions) {
    const sources = sourcesByField.get(contribution.field) ?? new Set<string>();
    sources.add(contribution.sourceId);
    sourcesByField.set(contribution.field, sources);
  }

  for (const [field, sources] of sourcesByField) {
    if (sources.size > 1) {
      throw new Error(
        `Cross-source aggregation is prohibited for living-person personal-detail field ` +
          `"${field}": sources [${[...sources].sort().join(', ')}] ( ugcLivingPersonRules)`,
      );
    }
  }
}

export type UgcLivingPersonClaimInput = {
  readonly livingStatus: string;
  readonly isUgcDerived: boolean;
  readonly confidenceScore: number;
};

/**
 * Elevated verification threshold: a UGC-derived claim about a living (or unknown-status,
 * treated-as-living) person must clear the constitution's existing high-impact publish
 * threshold (claimConfidenceThresholds.highImpactPublish, currently 0.9
 * packages/schemas/constitution/policy.v1.json) before it may advance.
 *
 * Decision: reuse the existing 0.9 high-impact tier rather than add a parallel threshold.
 * Living-person UGC claims are exactly the outsized-consequence category that tier already
 * models, so a second threshold would just be a second
 * name for the same number. See `ugcLivingPersonRules.elevatedClaimClass` in the constitution.
 */
export function assertUgcLivingPersonClaimMayAdvance(
  input: UgcLivingPersonClaimInput,
  policy: ProductConstitution = loadProductConstitution(),
): void {
  if (!input.isUgcDerived) {
    return;
  }
  if (!evaluateLivingStatus(input.livingStatus, policy).treatAsLiving) {
    return;
  }

  const elevatedClaimClass = policy.ugcLivingPersonRules.elevatedClaimClass;
  const evaluation = evaluateClaimConfidence(input.confidenceScore, elevatedClaimClass, policy);
  if (!evaluation.passesPublishThreshold) {
    throw new Error(
      `UGC-derived claim about a living person requires confidence >= ${evaluation.threshold} ` +
        `(${elevatedClaimClass} tier); got ${input.confidenceScore} ( ugcLivingPersonRules)`,
    );
  }
}

export type DeanonymizationAttempt = {
  readonly proposedAction: string;
  readonly targetsPseudonymousOrAnonymousSubject: boolean;
};

/**
 * Deanonymization prohibited everywhere: contractual for Reddit (see ./obligations.js),
 * policy for every other source. Fail-closed: any attempt tagged as targeting a
 * pseudonymous/anonymous UGC subject is rejected outright.
 *
 * Mirrors the fail-closed assertion pattern used by `assertPublicProjectionSafe`
 * (packages/security/src/serialize.ts). This module cannot import packages/security that
 * package depends on @repo/domain, so the reverse import would be circular so the
 * pattern is reproduced here rather than shared.
 */
export function assertNoDeanonymization(
  attempt: DeanonymizationAttempt,
  policy: ProductConstitution = loadProductConstitution(),
): void {
  if (!policy.ugcLivingPersonRules.deanonymizationProhibited) {
    return;
  }
  if (attempt.targetsPseudonymousOrAnonymousSubject) {
    throw new Error(
      `Deanonymization is prohibited: refusing to "${attempt.proposedAction}" against a ` +
        'pseudonymous/anonymous UGC subject ( ugcLivingPersonRules)',
    );
  }
}
