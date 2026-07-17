/**
 * Policy evaluation helpers for the product constitution.
 * Every result includes policyVersion so callers can audit which rules applied.
 * This module is read-only: it never mutates or persists policy configuration.
 */
import { loadProductConstitution } from './load.js';
import type { ClaimClass, ProductConstitution, RelevanceDecision } from './schema.js';

export type PolicyEvaluation<T extends Record<string, unknown>> = T & {
  policyVersion: string;
};

function withVersion<T extends Record<string, unknown>>(
  policy: ProductConstitution,
  result: T,
): PolicyEvaluation<T> {
  return { ...result, policyVersion: policy.policyVersion };
}

/** Unknown living status is treated as living when the constitution says so. */
export function evaluateLivingStatus(
  status: string,
  policy: ProductConstitution = loadProductConstitution(),
): PolicyEvaluation<{ treatAsLiving: boolean; status: string; recognized: boolean }> {
  const recognized = policy.livingPersonRules.statuses.includes(status);
  const treatAsLiving =
    status === 'living' || (policy.livingPersonRules.treatUnknownAsLiving && status === 'unknown');
  return withVersion(policy, { treatAsLiving, status, recognized });
}

/**
 * Reject prohibited public location precision (and living residential when configured).
 */
export function evaluatePublicPrecision(
  precision: string,
  options: { livingStatus?: string } = {},
  policy: ProductConstitution = loadProductConstitution(),
): PolicyEvaluation<{
  allowed: boolean;
  precision: string;
  reason?: string;
}> {
  const living = evaluateLivingStatus(options.livingStatus ?? 'deceased', policy);
  if (policy.publicPrecisionRules.prohibitedLevels.includes(precision)) {
    return withVersion(policy, {
      allowed: false,
      precision,
      reason: 'prohibited_location_precision',
    });
  }
  if (
    living.treatAsLiving &&
    policy.livingPersonRules.neverReturnResidentialPublicly &&
    policy.publicPrecisionRules.livingResidentialProhibited &&
    (precision === 'residence' || precision === 'street_address' || precision === 'unit')
  ) {
    return withVersion(policy, {
      allowed: false,
      precision,
      reason: 'living_residential_precision_prohibited',
    });
  }
  if (!policy.publicPrecisionRules.allowedLevels.includes(precision)) {
    return withVersion(policy, {
      allowed: false,
      precision,
      reason: 'unknown_precision_level',
    });
  }
  return withVersion(policy, { allowed: true, precision });
}

/**
 * Reject narrative text that uses unsupported procedural language stronger than evidence.
 */
export function evaluateProceduralLanguage(
  text: string,
  proceduralStatus: string,
  policy: ProductConstitution = loadProductConstitution(),
): PolicyEvaluation<{
  supported: boolean;
  proceduralStatusRecognized: boolean;
  violations: string[];
}> {
  const normalized = text.toLowerCase();
  const violations = policy.unsupportedProceduralLanguage.filter((phrase) =>
    normalized.includes(phrase.toLowerCase()),
  );
  const proceduralStatusRecognized = policy.legalStatusVocabulary.includes(proceduralStatus);
  const supported = violations.length === 0 && proceduralStatusRecognized;
  return withVersion(policy, {
    supported,
    proceduralStatusRecognized,
    violations,
  });
}

/** Evaluate a relevance score against constitution thresholds for a decision class. */
export function evaluateRelevance(
  score: number,
  decision: RelevanceDecision,
  policy: ProductConstitution = loadProductConstitution(),
): PolicyEvaluation<{ passes: boolean; decision: RelevanceDecision; score: number }> {
  const thresholds = policy.relevanceThresholds;
  const passes =
    decision === 'include'
      ? score >= thresholds.includeMinimum
      : decision === 'supporting_context'
        ? score >= thresholds.supportingContextMinimum
        : score < thresholds.excludeBelow;
  return withVersion(policy, { passes, decision, score });
}

/** Evaluate claim confidence against standard or high-impact publish thresholds. */
export function evaluateClaimConfidence(
  score: number,
  claimClass: ClaimClass,
  policy: ProductConstitution = loadProductConstitution(),
): PolicyEvaluation<{
  passesPublishThreshold: boolean;
  claimClass: ClaimClass;
  threshold: number;
  score: number;
}> {
  const thresholds = policy.claimConfidenceThresholds;
  const threshold =
    claimClass === 'high_impact' && policy.publicationRestrictions.highImpactRequiresHigherThreshold
      ? thresholds.highImpactPublish
      : thresholds.standardPublish;
  return withVersion(policy, {
    passesPublishThreshold: score >= threshold,
    claimClass,
    threshold,
    score,
  });
}

/** Confirm a maturity / source / legal-status token is in the constitution vocabulary. */
export function isRecognizedVocabulary(
  kind: 'maturity' | 'source' | 'legalStatus',
  value: string,
  policy: ProductConstitution = loadProductConstitution(),
): PolicyEvaluation<{ recognized: boolean; kind: string; value: string }> {
  const set =
    kind === 'maturity'
      ? policy.recordMaturityStates
      : kind === 'source'
        ? policy.sourceClassifications
        : policy.legalStatusVocabulary;
  return withVersion(policy, {
    recognized: set.includes(value),
    kind,
    value,
  });
}
