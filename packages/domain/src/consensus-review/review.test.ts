/**
 * Unit tests for reviewer-log accumulation, tallying, and agreement-threshold routing.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CONSENSUS_POLICY,
  assertIndependentReviews,
  recordReview,
  routeConsensusReview,
  tallyReviews,
  type ConsensusPolicy,
  type ReviewerClassification,
} from './index.js';

const NOW = '2026-07-17T04:00:00.000Z';
const LATER = '2026-07-17T05:00:00.000Z';

function review(
  reviewId: string,
  reviewerId: string,
  verdict: ReviewerClassification['verdict'],
  overrides: Partial<ReviewerClassification> = {},
): ReviewerClassification {
  return {
    reviewId,
    submissionId: 'submission-1',
    reviewerId,
    verdict,
    reviewedAt: NOW,
    ...overrides,
  };
}

test('recordReview appends independent reviews and rejects a repeat reviewer', () => {
  let log: readonly ReviewerClassification[] = [];
  log = recordReview(log, review('r1', 'reviewer-a', 'legitimate_lead'));
  log = recordReview(log, review('r2', 'reviewer-b', 'legitimate_lead'));
  assert.equal(log.length, 2);

  assert.throws(
    () => recordReview(log, review('r3', 'reviewer-a', 'not_legitimate')),
    /already reviewed/,
  );
});

test('recordReview rejects a review targeting a different submission than the existing log', () => {
  const log = [review('r1', 'reviewer-a', 'legitimate_lead')];
  assert.throws(
    () =>
      recordReview(
        log,
        review('r2', 'reviewer-b', 'legitimate_lead', { submissionId: 'submission-2' }),
      ),
    /targets submission/,
  );
});

test('assertIndependentReviews throws on duplicate reviewer ids regardless of order', () => {
  const reviews = [
    review('r1', 'reviewer-a', 'legitimate_lead'),
    review('r2', 'reviewer-b', 'unclear'),
    review('r3', 'reviewer-a', 'not_legitimate'),
  ];
  assert.throws(() => assertIndependentReviews(reviews), /already reviewed/);
});

test('tallyReviews counts verdicts and computes agreement ratio for a clear majority', () => {
  const reviews = [
    review('r1', 'reviewer-a', 'legitimate_lead'),
    review('r2', 'reviewer-b', 'legitimate_lead'),
    review('r3', 'reviewer-c', 'not_legitimate'),
  ];
  const tally = tallyReviews('submission-1', reviews);
  assert.equal(tally.totalReviews, 3);
  assert.equal(tally.distinctReviewers, 3);
  assert.equal(tally.byVerdict.legitimate_lead, 2);
  assert.equal(tally.byVerdict.not_legitimate, 1);
  assert.equal(tally.leadingVerdict, 'legitimate_lead');
  assert.equal(tally.agreementRatio, 2 / 3);
});

test('tallyReviews leaves leadingVerdict undefined on a tie, even a three-way tie', () => {
  const twoWay = tallyReviews('submission-1', [
    review('r1', 'reviewer-a', 'legitimate_lead'),
    review('r2', 'reviewer-b', 'not_legitimate'),
  ]);
  assert.equal(twoWay.leadingVerdict, undefined);

  const threeWay = tallyReviews('submission-1', [
    review('r1', 'reviewer-a', 'legitimate_lead'),
    review('r2', 'reviewer-b', 'not_legitimate'),
    review('r3', 'reviewer-c', 'unclear'),
  ]);
  assert.equal(threeWay.leadingVerdict, undefined);
});

test('tallyReviews is order-independent (deterministic tally)', () => {
  const reviews = [
    review('r1', 'reviewer-a', 'legitimate_lead'),
    review('r2', 'reviewer-b', 'legitimate_lead'),
    review('r3', 'reviewer-c', 'unclear'),
  ];
  const forward = tallyReviews('submission-1', reviews);
  const reversed = tallyReviews('submission-1', [...reviews].reverse());
  assert.deepEqual(forward, reversed);
});

test('tallyReviews rejects a review for a different submission id', () => {
  const reviews = [review('r1', 'reviewer-a', 'legitimate_lead', { submissionId: 'other' })];
  assert.throws(() => tallyReviews('submission-1', reviews), /targets submission/);
});

test('routeConsensusReview withholds routing below the minimum independent-review count', () => {
  const decision = routeConsensusReview(
    'submission-1',
    [review('r1', 'reviewer-a', 'legitimate_lead'), review('r2', 'reviewer-b', 'legitimate_lead')],
    NOW,
  );
  assert.equal(decision.status, 'insufficient_reviews');
  assert.equal(decision.reason, 'below_minimum_reviews');
});

test('routeConsensusReview auto-advances once the advance verdict clears the threshold', () => {
  const decision = routeConsensusReview(
    'submission-1',
    [
      review('r1', 'reviewer-a', 'legitimate_lead'),
      review('r2', 'reviewer-b', 'legitimate_lead'),
      review('r3', 'reviewer-c', 'legitimate_lead'),
    ],
    NOW,
  );
  assert.equal(decision.status, 'auto_advance');
  assert.equal(decision.reason, 'agreement_threshold_met');
  assert.equal(decision.tally.agreementRatio, 1);
});

test('routeConsensusReview auto-rejects once the reject verdict clears the threshold', () => {
  const decision = routeConsensusReview(
    'submission-1',
    [
      review('r1', 'reviewer-a', 'not_legitimate'),
      review('r2', 'reviewer-b', 'not_legitimate'),
      review('r3', 'reviewer-c', 'not_legitimate'),
    ],
    NOW,
  );
  assert.equal(decision.status, 'auto_reject');
  assert.equal(decision.reason, 'agreement_threshold_met');
});

test('routeConsensusReview never silently resolves a tie — it always routes to expert_review', () => {
  const decision = routeConsensusReview(
    'submission-1',
    [
      review('r1', 'reviewer-a', 'legitimate_lead'),
      review('r2', 'reviewer-b', 'not_legitimate'),
      review('r3', 'reviewer-c', 'unclear'),
    ],
    NOW,
  );
  assert.equal(decision.status, 'expert_review');
  assert.equal(decision.reason, 'tie_no_majority');
  // No leading verdict is asserted anywhere in the decision nothing was averaged or defaulted.
  assert.equal(decision.tally.leadingVerdict, undefined);
});

test('routeConsensusReview never silently resolves below-threshold agreement', () => {
  const decision = routeConsensusReview(
    'submission-1',
    [
      review('r1', 'reviewer-a', 'legitimate_lead'),
      review('r2', 'reviewer-b', 'legitimate_lead'),
      review('r3', 'reviewer-c', 'legitimate_lead'),
      review('r4', 'reviewer-d', 'not_legitimate'),
      review('r5', 'reviewer-e', 'not_legitimate'),
    ],
    NOW,
  );
  // 3/5 = 0.6, below the default 0.66 threshold, with a clear (non-tied) leader must still be
  // visible disagreement, not silently rounded up into auto_advance.
  assert.equal(decision.tally.leadingVerdict, 'legitimate_lead');
  assert.equal(decision.status, 'expert_review');
  assert.equal(decision.reason, 'agreement_below_threshold');
});

test('routeConsensusReview routes a confident but unmapped verdict to expert_review, not a default', () => {
  const decision = routeConsensusReview(
    'submission-1',
    [
      review('r1', 'reviewer-a', 'unclear'),
      review('r2', 'reviewer-b', 'unclear'),
      review('r3', 'reviewer-c', 'unclear'),
    ],
    NOW,
  );
  assert.equal(decision.status, 'expert_review');
  assert.equal(decision.reason, 'majority_verdict_is_unclear');
});

test('routeConsensusReview is deterministic for identical inputs at the same instant', () => {
  const reviews = [
    review('r1', 'reviewer-a', 'legitimate_lead'),
    review('r2', 'reviewer-b', 'legitimate_lead'),
    review('r3', 'reviewer-c', 'legitimate_lead'),
  ];
  const first = routeConsensusReview('submission-1', reviews, NOW);
  const second = routeConsensusReview('submission-1', [...reviews].reverse(), NOW);
  assert.deepEqual(first, second);
});

test('routeConsensusReview only reflects decidedAt from the caller-supplied now', () => {
  const reviews = [
    review('r1', 'reviewer-a', 'legitimate_lead'),
    review('r2', 'reviewer-b', 'legitimate_lead'),
    review('r3', 'reviewer-c', 'legitimate_lead'),
  ];
  const decision = routeConsensusReview('submission-1', reviews, LATER);
  assert.equal(decision.decidedAt, LATER);
});

test('routeConsensusReview rejects an invalid policy rather than silently normalizing it', () => {
  const reviews = [review('r1', 'reviewer-a', 'legitimate_lead')];
  const badPolicy: ConsensusPolicy = { ...DEFAULT_CONSENSUS_POLICY, agreementThreshold: 1.5 };
  assert.throws(
    () => routeConsensusReview('submission-1', reviews, NOW, badPolicy),
    /agreementThreshold/,
  );

  const samePolicy: ConsensusPolicy = {
    ...DEFAULT_CONSENSUS_POLICY,
    advanceVerdict: 'legitimate_lead',
    rejectVerdict: 'legitimate_lead',
  };
  assert.throws(
    () => routeConsensusReview('submission-1', reviews, NOW, samePolicy),
    /must differ/,
  );
});

test('a custom, stricter policy can require more reviewers and a higher bar', () => {
  const strict: ConsensusPolicy = {
    policyVersion: DEFAULT_CONSENSUS_POLICY.policyVersion,
    minimumIndependentReviews: 5,
    agreementThreshold: 0.8,
    advanceVerdict: 'legitimate_lead',
    rejectVerdict: 'not_legitimate',
  };
  const reviews = [
    review('r1', 'reviewer-a', 'legitimate_lead'),
    review('r2', 'reviewer-b', 'legitimate_lead'),
    review('r3', 'reviewer-c', 'legitimate_lead'),
  ];
  const decision = routeConsensusReview('submission-1', reviews, NOW, strict);
  assert.equal(decision.status, 'insufficient_reviews');
});
