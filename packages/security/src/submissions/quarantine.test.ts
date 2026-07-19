/**
 * Verifies validation, immutable originals, spam scoring, and campaign detection.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createQuarantinedSubmission,
  createSubmissionCampaignDetector,
  scoreSubmissionSpam,
  validateAndNormalizeSubmission,
  verifyOriginalIntegrity,
  type SubmissionInput,
} from './quarantine.ts';

const VALID_SUBMISSION: SubmissionInput = {
  kind: 'correction',
  title: 'Correct the opening year',
  statement: 'The institution opened in 1954 according to the attached public archives.',
  sourceUrls: ['https://archive.example.org/item/123#page=2'],
  targetRecordId: 'record-123',
  submitterContact: 'researcher@example.org',
};

test('accepts structured text and HTTPS source URLs into quarantine only', () => {
  const result = createQuarantinedSubmission(VALID_SUBMISSION, {
    receivedAtMs: Date.parse('2026-07-17T00:00:00.000Z'),
    privacyPepper: 'test-only-pepper',
    submitterToken: 'actor-hash-a',
  });

  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.record.destination, 'submission_quarantine');
  assert.equal(result.record.canonicalWriteAllowed, false);
  assert.equal(result.record.inboxState, 'accepted');
  assert.equal(result.record.moderationState, 'pending_review');
  assert.equal(result.record.normalized.sourceUrls[0], 'https://archive.example.org/item/123');
  assert.equal(result.record.privacy.contactPresent, true);
  assert.notEqual(result.record.privacy.contactDigest, VALID_SUBMISSION.submitterContact);
  assert.equal(JSON.stringify(result.record.normalized).includes('researcher@example.org'), false);
  assert.equal(verifyOriginalIntegrity(result.record), true);
});

test('rejects malformed, oversized, prohibited-character, and link-abuse submissions', () => {
  const malformed = validateAndNormalizeSubmission({
    ...VALID_SUBMISSION,
    upload: { filename: 'evidence.pdf' },
  });
  assert.equal(malformed.valid, false);
  if (!malformed.valid) {
    assert.ok(malformed.issues.some((entry) => entry.reason === 'schema_invalid'));
  }

  const invalid = validateAndNormalizeSubmission(
    {
      ...VALID_SUBMISSION,
      statement: `A valid-length statement\u202E ${'https://example.org/x '.repeat(12)}`,
      sourceUrls: Array.from({ length: 12 }, (_, index) => `http://example.org/${index}`),
    },
    { limits: { maxBytes: 200 } },
  );
  assert.equal(invalid.valid, false);
  if (!invalid.valid) {
    const reasons = new Set(invalid.issues.map((entry) => entry.reason));
    assert.ok(reasons.has('oversized'));
    assert.ok(reasons.has('characters_invalid'));
    assert.ok(reasons.has('too_many_links'));
    assert.ok(reasons.has('source_url_invalid'));
  }
});

test('rejects submissions that exceed the independent frequency policy', () => {
  const nowMs = 1_700_000_000_000;
  const result = validateAndNormalizeSubmission(VALID_SUBMISSION, {
    nowMs,
    limits: { maxSubmissionsPerWindow: 2, frequencyWindowMs: 60_000 },
    recentSubmissionTimestamps: [nowMs - 10, nowMs - 20],
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.issues.some((entry) => entry.reason === 'frequency_exceeded'));
  }
});

test('scores deterministic spam signals without auto-promoting content', () => {
  const assessment = scoreSubmissionSpam({
    kind: 'contribution',
    title: 'BUY NOW GUARANTEED PROFIT',
    statement:
      'CLICK HERE CLICK HERE CLICK HERE CLICK HERE CLICK HERE CLICK HERE CLICK HERE!!!!!!!!!!',
    sourceUrls: Array.from({ length: 5 }, (_, index) => `https://spam.example/${index}`),
  });
  assert.equal(assessment.shouldFlag, true);
  assert.ok(assessment.score >= 40);
  assert.ok(assessment.signals.includes('link_density'));
  assert.ok(assessment.signals.includes('suspicious_phrase'));
});

test('detects duplicate and coordinated submissions across actor dimensions', () => {
  const detector = createSubmissionCampaignDetector({
    coordinatedActorThreshold: 3,
    windowMs: 60_000,
  });
  const baseContext = {
    receivedAtMs: 1_700_000_000_000,
    privacyPepper: 'test-only-pepper',
    networkToken: 'network-a',
  };

  const first = createQuarantinedSubmission(
    VALID_SUBMISSION,
    { ...baseContext, submitterToken: 'actor-a' },
    detector,
  );
  const second = createQuarantinedSubmission(
    VALID_SUBMISSION,
    { ...baseContext, receivedAtMs: baseContext.receivedAtMs + 1, submitterToken: 'actor-b' },
    detector,
  );
  const third = createQuarantinedSubmission(
    VALID_SUBMISSION,
    { ...baseContext, receivedAtMs: baseContext.receivedAtMs + 2, submitterToken: 'actor-c' },
    detector,
  );

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(third.accepted, true);
  if (!first.accepted || !second.accepted || !third.accepted) return;
  assert.equal(second.record.moderationState, 'duplicate');
  assert.equal(second.record.campaign.duplicateOf[0], first.record.id);
  assert.equal(third.record.moderationState, 'coordinated_campaign');
  assert.equal(third.record.campaign.coordinated, true);
  assert.ok(third.record.campaign.signals.includes('actor_cluster'));
});

test('original payload and nested values are runtime immutable and auditable', () => {
  const mutable = {
    ...VALID_SUBMISSION,
    sourceUrls: [...VALID_SUBMISSION.sourceUrls],
  };
  const result = createQuarantinedSubmission(mutable, {
    privacyPepper: 'test-only-pepper',
    receivedAtMs: 1_700_000_000_000,
  });
  assert.equal(result.accepted, true);
  if (!result.accepted) return;

  mutable.title = 'mutated outside';
  mutable.sourceUrls[0] = 'https://attacker.example/';
  assert.equal(result.record.original.payload.title, VALID_SUBMISSION.title);
  assert.equal(result.record.original.payload.sourceUrls[0], VALID_SUBMISSION.sourceUrls[0]);
  assert.equal(Object.isFrozen(result.record.original), true);
  assert.equal(Object.isFrozen(result.record.original.payload.sourceUrls), true);
  assert.throws(() => {
    (result.record.original.payload as { title: string }).title = 'mutated inside';
  }, TypeError);
  assert.equal(verifyOriginalIntegrity(result.record), true);
});
