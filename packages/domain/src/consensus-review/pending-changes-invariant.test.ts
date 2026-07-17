/**
 * Integration-style test for BB-076's pending-changes invariant (Wikipedia model): a
 * community lead must pass BOTH consensus review AND the standard BB-044 research-case /
 * BB-032 promotion pipeline before anything from this lane could ever become visible on a
 * public read path. This test walks the real chain — BB-029 quarantine
 * (`@black-book/security`) → consensus review → discovery-candidate research case — and stops
 * there deliberately: it never imports `../promotion`, never builds a `PromotionClaim`, and
 * proves with the *existing*, unmodified BB-044 gate (`markResearchCasePublished`) that the
 * research case this lane produces cannot be published from where consensus review leaves it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQuarantinedSubmission, type SubmissionIntakeContext } from '@black-book/security';
import { prepareResearchCasePromotion, markResearchCasePublished } from '../research-case/index.js';
import { advanceToDiscoveryCandidate } from './advance.js';
import { routeConsensusReview, type ReviewerClassification } from './index.js';

const NOW_MS = Date.parse('2026-07-17T04:00:00.000Z');
const NOW = new Date(NOW_MS).toISOString();

function review(
  reviewId: string,
  reviewerId: string,
  verdict: ReviewerClassification['verdict'],
  submissionId: string,
): ReviewerClassification {
  return { reviewId, submissionId, reviewerId, verdict, reviewedAt: NOW };
}

test('a community lead cannot reach a public read path without both consensus review and the standard research pipeline', () => {
  // Step 1: the public submission lands in BB-029 quarantine — never a canonical write.
  const intakeContext: SubmissionIntakeContext = {
    receivedAtMs: NOW_MS,
    privacyPepper: 'test-pepper-do-not-use-in-prod',
  };
  const quarantineResult = createQuarantinedSubmission(
    {
      kind: 'contribution',
      title: 'Closed alumni Facebook group post about a demolished Rosenwald school',
      statement:
        'A member of a closed alumni Facebook group posted photos and a firsthand account of ' +
        'a Rosenwald school building that was demolished in the 1970s. The group is private ' +
        'and not indexed by any compliant API, so this is a human-submitted lead.',
      sourceUrls: ['https://example.org/community-archive/rosenwald-notes'],
    },
    intakeContext,
  );
  assert.equal(quarantineResult.accepted, true);
  if (!quarantineResult.accepted) return;
  const quarantined = quarantineResult.record;

  assert.equal(quarantined.destination, 'submission_quarantine');
  assert.equal(quarantined.canonicalWriteAllowed, false);
  assert.equal(quarantined.inboxState, 'accepted');

  // Step 2: three independent reviewers agree it is a legitimate lead — consensus routes to
  // auto_advance only because the agreement threshold was actually cleared.
  const submissionId = quarantined.id;
  const decision = routeConsensusReview(
    submissionId,
    [
      review('review-1', 'reviewer-a', 'legitimate_lead', submissionId),
      review('review-2', 'reviewer-b', 'legitimate_lead', submissionId),
      review('review-3', 'reviewer-c', 'legitimate_lead', submissionId),
    ],
    NOW,
  );
  assert.equal(decision.status, 'auto_advance');

  // Step 3: the only artifact consensus review may produce — a discovery-candidate research
  // case in BB-044's earliest `candidate` state.
  const advancement = advanceToDiscoveryCandidate({
    decision,
    lead: { submissionId, title: quarantined.normalized.title },
    researchCaseId: `research-case-${submissionId}`,
    now: NOW,
  });

  const researchCase = advancement.researchCase;
  assert.equal(researchCase.state, 'candidate');
  assert.equal(researchCase.history.length, 0, 'consensus review must not itself advance the case further');
  assert.equal(researchCase.publication, undefined, 'a fresh candidate is never published');

  // Step 4 (the invariant): the standard, unmodified BB-044 gate refuses to publish this case.
  // Reaching a public read path still requires relevance review, minimum-record evidence, and
  // (separately, out of this lane's reach) a BB-032 promotion approval — none of which this
  // lane can skip.
  const promotionPreview = prepareResearchCasePromotion({
    record: researchCase,
    currentClaims: [],
    candidateClaims: [],
  });
  assert.equal(promotionPreview.eligible, false);
  assert.deepEqual(
    [...promotionPreview.reasonCodes].sort(),
    ['minimum_record_incomplete', 'relevance_not_confirmed'],
  );
  assert.equal(promotionPreview.preview.publishable, false);

  assert.throws(
    () =>
      markResearchCasePublished(researchCase, {
        releaseId: 'release-should-never-happen',
        revision: 'rev-1',
        publishedAt: NOW,
      }),
    /does not meet publication requirements/,
  );
});

test('expert_review and auto_reject decisions never reach even a discovery candidate', () => {
  const submissionId = 'submission-disagreement';
  const disagreement = routeConsensusReview(
    submissionId,
    [
      review('review-1', 'reviewer-a', 'legitimate_lead', submissionId),
      review('review-2', 'reviewer-b', 'not_legitimate', submissionId),
      review('review-3', 'reviewer-c', 'unclear', submissionId),
    ],
    NOW,
  );
  assert.equal(disagreement.status, 'expert_review');
  assert.throws(() =>
    advanceToDiscoveryCandidate({
      decision: disagreement,
      lead: { submissionId, title: 'Disputed lead' },
      researchCaseId: 'research-case-disagreement',
      now: NOW,
    }),
  );

  const rejectedSubmissionId = 'submission-rejected';
  const rejected = routeConsensusReview(
    rejectedSubmissionId,
    [
      review('review-4', 'reviewer-a', 'not_legitimate', rejectedSubmissionId),
      review('review-5', 'reviewer-b', 'not_legitimate', rejectedSubmissionId),
      review('review-6', 'reviewer-c', 'not_legitimate', rejectedSubmissionId),
    ],
    NOW,
  );
  assert.equal(rejected.status, 'auto_reject');
  assert.throws(() =>
    advanceToDiscoveryCandidate({
      decision: rejected,
      lead: { submissionId: rejectedSubmissionId, title: 'Rejected lead' },
      researchCaseId: 'research-case-rejected',
      now: NOW,
    }),
  );
});
