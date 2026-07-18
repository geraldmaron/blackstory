/**
 * Publication thresholds and narrative citation gates for claims.
 * High-impact claims use the higher constitution threshold.
 * Narratives cannot cite unpublished claims.
 */
import {
  evaluateClaimConfidence,
  evaluateProceduralLanguage,
  loadProductConstitution,
  type ClaimClass,
  type ProductConstitution,
} from '@blap/schemas';
import {
  claimClassThreshold,
  isClaimPublished,
  type AtomicClaim,
} from './claim.js';
import type { ConfidenceScore } from './confidence.js';

export type PublicationThresholdResult = {
  readonly claimClass: ClaimClass;
  readonly score: number;
  readonly threshold: number;
  readonly passesPublishThreshold: boolean;
  readonly policyVersion: string;
};

/** Evaluate a confidence score against the claim-class publication threshold. */
export function evaluatePublicationThreshold(
  score: number,
  claimClass: ClaimClass,
  policy: ProductConstitution = loadProductConstitution(),
): PublicationThresholdResult {
  const evaluated = evaluateClaimConfidence(score, claimClass, policy);
  return {
    claimClass: evaluated.claimClass,
    score: evaluated.score,
    threshold: evaluated.threshold,
    passesPublishThreshold: evaluated.passesPublishThreshold,
    policyVersion: evaluated.policyVersion,
  };
}

export function highImpactUsesHigherThreshold(
  policy: ProductConstitution = loadProductConstitution(),
): boolean {
  return (
    policy.publicationRestrictions.highImpactRequiresHigherThreshold &&
    policy.claimConfidenceThresholds.highImpactPublish >
      policy.claimConfidenceThresholds.standardPublish
  );
}

export function assertHighImpactThresholdHigher(
  policy: ProductConstitution = loadProductConstitution(),
): void {
  if (!highImpactUsesHigherThreshold(policy)) {
    throw new Error('High-impact claims must use a higher publish threshold than standard');
  }
  const standard = claimClassThreshold('standard', policy);
  const highImpact = claimClassThreshold('high_impact', policy);
  if (!(highImpact > standard)) {
    throw new Error('highImpactPublish must be greater than standardPublish');
  }
}

/**
 * Narratives (and public prose assemblers) may only cite published accepted claims.
 */
export function assertNarrativeMayCiteClaim(
  claim: Pick<AtomicClaim, 'id' | 'workflowStatus' | 'publicationStatus'>,
): void {
  if (!isClaimPublished(claim)) {
    throw new Error(
      `Narrative cannot cite unpublished claim ${claim.id} (workflow=${claim.workflowStatus}, publication=${claim.publicationStatus})`,
    );
  }
}

export function narrativeMayCiteClaim(
  claim: Pick<AtomicClaim, 'workflowStatus' | 'publicationStatus'>,
): boolean {
  return isClaimPublished(claim);
}

/**
 * Claim may be published only when confidence passes the class threshold and
 * constitution requires accepted claim + evidence are satisfied by the caller.
 */
export function assertClaimMayPublish(input: {
  readonly claim: Pick<AtomicClaim, 'claimClass' | 'workflowStatus' | 'proceduralStatus'>;
  readonly confidence: Pick<ConfidenceScore, 'score' | 'policyVersion'>;
  readonly hasQualifyingEvidence: boolean;
  readonly narrativeSnippet?: string;
  readonly policy?: ProductConstitution;
}): PublicationThresholdResult {
  const policy = input.policy ?? loadProductConstitution();

  if (input.claim.workflowStatus !== 'accepted') {
    throw new Error('Only accepted claims may publish');
  }
  if (policy.publicationRestrictions.requireAcceptedClaimAndEvidence && !input.hasQualifyingEvidence) {
    throw new Error('Publication requires accepted claim and qualifying evidence');
  }

  const threshold = evaluatePublicationThreshold(
    input.confidence.score,
    input.claim.claimClass,
    policy,
  );
  if (!threshold.passesPublishThreshold) {
    throw new Error(
      `Confidence ${threshold.score} below ${threshold.claimClass} publish threshold ${threshold.threshold}`,
    );
  }

  if (
    input.narrativeSnippet &&
    policy.publicationRestrictions.publicLanguageCannotExceedProceduralStatus
  ) {
    const procedural = evaluateProceduralLanguage(
      input.narrativeSnippet,
      input.claim.proceduralStatus,
      policy,
    );
    if (!procedural.supported) {
      throw new Error(
        `Narrative procedural language unsupported (violations: ${procedural.violations.join(', ') || 'unrecognized status'})`,
      );
    }
  }

  return threshold;
}
