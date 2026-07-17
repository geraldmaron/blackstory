/**
 * Deterministic reviewer-log accumulation, tallying, and agreement-threshold routing for
 * consensus review. Every function here is pure: no clocks, no randomness, no I/O 
 * callers supply `now` and persist the returned values themselves.
 */
import {
  CONSENSUS_REVIEW_POLICY_VERSION,
  DEFAULT_CONSENSUS_POLICY,
  REVIEW_VERDICTS,
  type ConsensusPolicy,
  type ConsensusRoutingDecision,
  type ConsensusRoutingReason,
  type ConsensusRoutingStatus,
  type ConsensusTally,
  type ReviewVerdict,
  type ReviewerClassification,
} from './types.js';

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required`);
}

function assertIsoDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO-compatible date`);
  }
}

function assertSameSubmission(
  submissionId: string,
  reviews: readonly ReviewerClassification[],
): void {
  for (const review of reviews) {
    if (review.submissionId !== submissionId) {
      throw new Error(
        `Review ${review.reviewId} targets submission ${review.submissionId}, not ${submissionId}`,
      );
    }
  }
}

/** Throws if any two reviews in the log share a reviewerId reviews must be independent. */
export function assertIndependentReviews(reviews: readonly ReviewerClassification[]): void {
  const seen = new Set<string>();
  for (const review of reviews) {
    assertNonEmpty(review.reviewId, 'reviewId');
    assertNonEmpty(review.submissionId, 'submissionId');
    assertNonEmpty(review.reviewerId, 'reviewerId');
    assertIsoDate(review.reviewedAt, 'reviewedAt');
    if (seen.has(review.reviewerId)) {
      throw new Error(
        `Reviewer ${review.reviewerId} has already reviewed this submission — reviews must be independent`,
      );
    }
    seen.add(review.reviewerId);
  }
}

/**
 * Appends one independent reviewer classification to a review log. This is the only supported
 * way to record a review it enforces the independence invariant (one review per reviewer per
 * submission) at write time rather than leaving it to be discovered at tally time.
 */
export function recordReview(
  reviews: readonly ReviewerClassification[],
  submission: ReviewerClassification,
): readonly ReviewerClassification[] {
  assertSameSubmission(submission.submissionId, reviews);
  const next = Object.freeze([...reviews, submission]);
  assertIndependentReviews(next);
  return next;
}

/** Deterministic tally over N independent reviewer classifications of one submission. */
export function tallyReviews(
  submissionId: string,
  reviews: readonly ReviewerClassification[],
): ConsensusTally {
  assertNonEmpty(submissionId, 'submissionId');
  assertSameSubmission(submissionId, reviews);
  assertIndependentReviews(reviews);

  const byVerdict: Record<ReviewVerdict, number> = {
    legitimate_lead: 0,
    not_legitimate: 0,
    unclear: 0,
  };
  for (const review of reviews) {
    byVerdict[review.verdict] += 1;
  }

  const total = reviews.length;
  let leading: ReviewVerdict | undefined;
  let leadingCount = -1;
  let tied = false;
  for (const verdict of REVIEW_VERDICTS) {
    const count = byVerdict[verdict];
    if (count > leadingCount) {
      leading = verdict;
      leadingCount = count;
      tied = false;
    } else if (count === leadingCount && count > 0) {
      tied = true;
    }
  }
  const leadingVerdict = total > 0 && !tied ? leading : undefined;

  return Object.freeze({
    submissionId,
    policyVersion: CONSENSUS_REVIEW_POLICY_VERSION,
    totalReviews: total,
    distinctReviewers: new Set(reviews.map((review) => review.reviewerId)).size,
    byVerdict: Object.freeze(byVerdict),
    ...(leadingVerdict ? { leadingVerdict } : {}),
    agreementRatio: total > 0 ? leadingCount / total : 0,
  });
}

function assertValidPolicy(policy: ConsensusPolicy): void {
  if (policy.minimumIndependentReviews < 1) {
    throw new Error('minimumIndependentReviews must be at least 1');
  }
  if (
    !Number.isFinite(policy.agreementThreshold) ||
    policy.agreementThreshold <= 0 ||
    policy.agreementThreshold > 1
  ) {
    throw new Error('agreementThreshold must be within (0, 1]');
  }
  if (policy.advanceVerdict === policy.rejectVerdict) {
    throw new Error('advanceVerdict and rejectVerdict must differ');
  }
}

/**
 * Routes a quarantined lead by reviewer agreement (Zooniverse/Caesar pattern): below the
 * minimum independent-review count, routing is withheld; a tie or below-threshold agreement
 * is genuine disagreement and always produces the distinct `expert_review` status it is
 * never averaged, defaulted, or silently folded into an auto-advance/auto-reject outcome.
 */
export function routeConsensusReview(
  submissionId: string,
  reviews: readonly ReviewerClassification[],
  now: string,
  policy: ConsensusPolicy = DEFAULT_CONSENSUS_POLICY,
): ConsensusRoutingDecision {
  assertIsoDate(now, 'now');
  assertValidPolicy(policy);
  const tally = tallyReviews(submissionId, reviews);

  let status: ConsensusRoutingStatus;
  let reason: ConsensusRoutingReason;

  if (tally.distinctReviewers < policy.minimumIndependentReviews) {
    status = 'insufficient_reviews';
    reason = 'below_minimum_reviews';
  } else if (!tally.leadingVerdict) {
    status = 'expert_review';
    reason = 'tie_no_majority';
  } else if (tally.agreementRatio < policy.agreementThreshold) {
    status = 'expert_review';
    reason = 'agreement_below_threshold';
  } else if (tally.leadingVerdict === policy.advanceVerdict) {
    status = 'auto_advance';
    reason = 'agreement_threshold_met';
  } else if (tally.leadingVerdict === policy.rejectVerdict) {
    status = 'auto_reject';
    reason = 'agreement_threshold_met';
  } else {
    // Strong agreement landed on a verdict the policy doesn't wire to advance/reject (e.g. a
    // confident 'unclear'). Still never silently resolved routes to a human.
    status = 'expert_review';
    reason = 'majority_verdict_is_unclear';
  }

  return Object.freeze({
    submissionId,
    status,
    reason,
    policyVersion: CONSENSUS_REVIEW_POLICY_VERSION,
    tally,
    decidedAt: now,
  });
}
