/**
 * Domain contracts for the BB-076 community-lead consensus review lane.
 *
 * Design references named by the bead:
 *  - Zooniverse/Caesar pattern: independent reviewer classifications ("N independent reviews")
 *    are tallied and routed by a deterministic agreement threshold; disagreement never
 *    silently resolves into a default — it produces its own distinct routing state.
 *  - Wikipedia pending-changes pattern: untrusted content stays invisible until reviewed.
 *    `advance.ts` in this module is the only place a lead may exit quarantine, and it only
 *    ever produces a BB-044 research case in its earliest `candidate` state (see
 *    `../research-case/index.js`) — never a promoted or published claim. This module never
 *    imports from `@black-book/security` or `@black-book/firebase`: it is pure, deterministic
 *    domain logic over already-quarantined submission identifiers supplied by a caller
 *    (the public intake surface in `apps/web/src/app/submit/`).
 */

export const CONSENSUS_REVIEW_POLICY_VERSION = '1.0.0' as const;

/** A reviewer's independent classification of one quarantined lead (a Zooniverse "classification"). */
export type ReviewVerdict = 'legitimate_lead' | 'not_legitimate' | 'unclear';

export const REVIEW_VERDICTS: readonly ReviewVerdict[] = Object.freeze([
  'legitimate_lead',
  'not_legitimate',
  'unclear',
]);

export type ReviewerClassification = {
  readonly reviewId: string;
  readonly submissionId: string;
  readonly reviewerId: string;
  readonly verdict: ReviewVerdict;
  readonly reviewedAt: string;
  readonly notes?: string;
};

export type ConsensusPolicy = {
  readonly policyVersion: typeof CONSENSUS_REVIEW_POLICY_VERSION;
  /** Minimum number of distinct independent reviewers required before any routing decision (N). */
  readonly minimumIndependentReviews: number;
  /** Fraction of reviews (0,1] that must share the leading verdict to route automatically. */
  readonly agreementThreshold: number;
  /** Verdict that, on reaching agreementThreshold, advances the lead into research. */
  readonly advanceVerdict: ReviewVerdict;
  /** Verdict that, on reaching agreementThreshold, auto-rejects the lead (stays quarantined). */
  readonly rejectVerdict: ReviewVerdict;
};

export const DEFAULT_CONSENSUS_POLICY: ConsensusPolicy = Object.freeze({
  policyVersion: CONSENSUS_REVIEW_POLICY_VERSION,
  minimumIndependentReviews: 3,
  agreementThreshold: 0.66,
  advanceVerdict: 'legitimate_lead',
  rejectVerdict: 'not_legitimate',
});

export type ConsensusTally = {
  readonly submissionId: string;
  readonly policyVersion: typeof CONSENSUS_REVIEW_POLICY_VERSION;
  readonly totalReviews: number;
  readonly distinctReviewers: number;
  readonly byVerdict: Readonly<Record<ReviewVerdict, number>>;
  /** The verdict with strictly the most votes; absent whenever two or more verdicts tie for the lead. */
  readonly leadingVerdict?: ReviewVerdict;
  /** leadingVerdict's share of totalReviews; 0 when there are no reviews yet. */
  readonly agreementRatio: number;
};

export const CONSENSUS_ROUTING_STATUSES = [
  'insufficient_reviews',
  'auto_advance',
  'auto_reject',
  'expert_review',
] as const;

export type ConsensusRoutingStatus = (typeof CONSENSUS_ROUTING_STATUSES)[number];

export type ConsensusRoutingReason =
  | 'below_minimum_reviews'
  | 'agreement_threshold_met'
  | 'agreement_below_threshold'
  | 'tie_no_majority'
  | 'majority_verdict_is_unclear';

/** A distinct, visible outcome for every case — including disagreement. Never averaged, never defaulted. */
export type ConsensusRoutingDecision = {
  readonly submissionId: string;
  readonly status: ConsensusRoutingStatus;
  readonly reason: ConsensusRoutingReason;
  readonly policyVersion: typeof CONSENSUS_REVIEW_POLICY_VERSION;
  readonly tally: ConsensusTally;
  readonly decidedAt: string;
};
