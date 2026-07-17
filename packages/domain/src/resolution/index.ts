/**
 * Public surface for deterministic, review-safe entity and historical-location resolution.
 */
export {
  normalizeAlias,
  normalizeOrganizationName,
  nameSimilarity,
  parseAddress,
} from './normalization.js';

export {
  scoreEntityMatch,
  resolveEntityCandidate,
  resolutionCandidateFromDiscovery,
  createDuplicateReviewQueueItem,
  applyResolutionDecision,
  reverseResolutionDecision,
} from './resolver.js';

export type {
  ParsedAddress,
  ResolutionCandidate,
  ResolutionProfile,
  ResolutionContext,
  MatchFactor,
  RankedEntityMatch,
  ResolutionOutcome,
  ResolutionResult,
  DuplicateReviewQueueItem,
  ResolutionDecision,
} from './types.js';
