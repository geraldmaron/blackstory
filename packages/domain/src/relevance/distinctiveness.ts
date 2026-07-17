/**
 * Distinctiveness and duplication checks for relevance assessments (BB-040).
 */
import { contentHashesEqual } from '../provenance/hashes.js';
import type { DiscoveryCandidateRecord } from '../discovery/types.js';
import type { RelevanceAssessment } from './types.js';

/** Stable key for distinctiveness comparisons within a review batch. */
export function computeDistinctivenessKey(candidate: DiscoveryCandidateRecord): string {
  return candidate.identity.identityKey;
}

export function isDuplicateOfIncluded(
  candidate: DiscoveryCandidateRecord,
  existingAssessments: readonly RelevanceAssessment[],
): boolean {
  const key = computeDistinctivenessKey(candidate);
  return existingAssessments.some(
    (prior) =>
      prior.decision === 'include' &&
      prior.candidateId !== candidate.id &&
      prior.distinctivenessKey === key,
  );
}

export function sharesContentHashWithIncluded(
  candidate: DiscoveryCandidateRecord,
  existingAssessments: readonly RelevanceAssessment[],
  candidatesById: ReadonlyMap<string, DiscoveryCandidateRecord>,
): boolean {
  for (const prior of existingAssessments) {
    if (prior.decision !== 'include' || prior.candidateId === candidate.id) {
      continue;
    }
    const priorCandidate = candidatesById.get(prior.candidateId);
    if (!priorCandidate) {
      continue;
    }
    if (contentHashesEqual(candidate.identity.contentHash, priorCandidate.identity.contentHash)) {
      return true;
    }
  }
  return false;
}

export function detectDuplicateCandidate(
  candidate: DiscoveryCandidateRecord,
  existingAssessments: readonly RelevanceAssessment[],
  candidatesById?: ReadonlyMap<string, DiscoveryCandidateRecord>,
): boolean {
  if (isDuplicateOfIncluded(candidate, existingAssessments)) {
    return true;
  }
  if (candidatesById) {
    return sharesContentHashWithIncluded(candidate, existingAssessments, candidatesById);
  }
  return false;
}
