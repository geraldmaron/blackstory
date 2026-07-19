/**
 * Public boundary for community-lead consensus review: independent reviewer tallying,
 * agreement-threshold routing, and the sole bridge into a discovery-candidate research
 * case. See `types.ts` for the design references (Zooniverse/Caesar, Wikipedia pending-changes).
 */
export {
  CONSENSUS_REVIEW_POLICY_VERSION,
  REVIEW_VERDICTS,
  DEFAULT_CONSENSUS_POLICY,
  CONSENSUS_ROUTING_STATUSES,
} from './types.js';
export type {
  ReviewVerdict,
  ReviewerClassification,
  ConsensusPolicy,
  ConsensusTally,
  ConsensusRoutingStatus,
  ConsensusRoutingReason,
  ConsensusRoutingDecision,
} from './types.js';

export {
  assertIndependentReviews,
  recordReview,
  tallyReviews,
  routeConsensusReview,
} from './review.js';

export { advanceToDiscoveryCandidate } from './advance.js';
export type { QuarantinedLeadSummary, DiscoveryCandidateAdvancement } from './advance.js';
