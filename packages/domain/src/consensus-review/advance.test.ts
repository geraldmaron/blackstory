/**
 * Unit tests for the sole consensus-review exit into a discovery-candidate research case.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceToDiscoveryCandidate } from './advance.js';
import { routeConsensusReview, type ReviewerClassification } from './index.js';

const NOW = '2026-07-17T04:00:00.000Z';

function review(
  reviewId: string,
  reviewerId: string,
  verdict: ReviewerClassification['verdict'],
): ReviewerClassification {
  return { reviewId, submissionId: 'submission-1', reviewerId, verdict, reviewedAt: NOW };
}

const advanceDecision = routeConsensusReview(
  'submission-1',
  [
    review('r1', 'reviewer-a', 'legitimate_lead'),
    review('r2', 'reviewer-b', 'legitimate_lead'),
    review('r3', 'reviewer-c', 'legitimate_lead'),
  ],
  NOW,
);

test('advanceToDiscoveryCandidate opens a research case in the earliest candidate state', () => {
  const result = advanceToDiscoveryCandidate({
    decision: advanceDecision,
    lead: {
      submissionId: 'submission-1',
      title: 'A closed Facebook group post about a lost school',
    },
    researchCaseId: 'research-case-1',
    now: NOW,
  });

  assert.equal(result.researchCase.state, 'candidate');
  assert.equal(result.researchCase.candidateId, 'submission-1');
  assert.equal(result.researchCase.checklist.items.length, 0);
  assert.equal(result.researchCase.history.length, 0);
  assert.equal(result.researchCase.publication, undefined);
  assert.equal(result.consensus, advanceDecision);
});

test('advanceToDiscoveryCandidate refuses an expert_review decision', () => {
  const tie = routeConsensusReview(
    'submission-1',
    [
      review('r1', 'reviewer-a', 'legitimate_lead'),
      review('r2', 'reviewer-b', 'not_legitimate'),
      review('r3', 'reviewer-c', 'legitimate_lead'),
      review('r4', 'reviewer-d', 'not_legitimate'),
    ],
    NOW,
  );
  assert.equal(tie.status, 'expert_review');
  assert.throws(
    () =>
      advanceToDiscoveryCandidate({
        decision: tie,
        lead: { submissionId: 'submission-1', title: 'Ambiguous lead' },
        researchCaseId: 'research-case-2',
        now: NOW,
      }),
    /Only an auto_advance/,
  );
});

test('advanceToDiscoveryCandidate refuses an auto_reject decision', () => {
  const rejected = routeConsensusReview(
    'submission-1',
    [
      review('r1', 'reviewer-a', 'not_legitimate'),
      review('r2', 'reviewer-b', 'not_legitimate'),
      review('r3', 'reviewer-c', 'not_legitimate'),
    ],
    NOW,
  );
  assert.throws(
    () =>
      advanceToDiscoveryCandidate({
        decision: rejected,
        lead: { submissionId: 'submission-1', title: 'Rejected lead' },
        researchCaseId: 'research-case-3',
        now: NOW,
      }),
    /Only an auto_advance/,
  );
});

test('advanceToDiscoveryCandidate refuses an insufficient_reviews decision', () => {
  const insufficient = routeConsensusReview(
    'submission-1',
    [review('r1', 'reviewer-a', 'legitimate_lead')],
    NOW,
  );
  assert.throws(
    () =>
      advanceToDiscoveryCandidate({
        decision: insufficient,
        lead: { submissionId: 'submission-1', title: 'Too few reviews' },
        researchCaseId: 'research-case-4',
        now: NOW,
      }),
    /Only an auto_advance/,
  );
});

test('advanceToDiscoveryCandidate refuses a lead/decision submission id mismatch', () => {
  assert.throws(
    () =>
      advanceToDiscoveryCandidate({
        decision: advanceDecision,
        lead: { submissionId: 'submission-does-not-match', title: 'Mismatched lead' },
        researchCaseId: 'research-case-5',
        now: NOW,
      }),
    /different submissions/,
  );
});
