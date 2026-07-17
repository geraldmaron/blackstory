/**
 * Public relevance projection hides numeric scores.
 */
import type { PublicRelevanceExplanation, RelevanceAssessment } from './types.js';
import { assertExplanationHasNoNumericScore } from './why.js';

export function toPublicRelevanceExplanation(
  assessment: RelevanceAssessment,
): PublicRelevanceExplanation {
  assertExplanationHasNoNumericScore(assessment.whyThisAppears);
  return {
    whyThisAppears: assessment.whyThisAppears,
    decision: assessment.decision,
  };
}

export function assertPublicRelevanceHasNoScore(
  publicExplanation: PublicRelevanceExplanation,
  assessment: RelevanceAssessment,
): void {
  const serialized = JSON.stringify(publicExplanation);
  if (serialized.includes(String(assessment.compositeScore))) {
    throw new Error('Public relevance projection must not expose composite score.');
  }
  if ('compositeScore' in publicExplanation) {
    throw new Error('Public relevance projection must not include compositeScore field.');
  }
  if ('featureValues' in publicExplanation) {
    throw new Error('Public relevance projection must not include featureValues field.');
  }
  assertExplanationHasNoNumericScore(publicExplanation.whyThisAppears);
}
