/**
 * Unit tests for public status mapping — no moderation-sensitive leakage.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPublicCorrectionStatus,
  isAppealEligible,
  mapModerationToPublicPhase,
} from './public-status.ts';

test('maps coordinated campaign moderation to under_review without exposing brigading', () => {
  const status = buildPublicCorrectionStatus({
    receiptCode: 'BB-COR-0123456789ABCDEF',
    moderationState: 'coordinated_campaign',
    submittedAt: '2026-07-17T12:00:00.000Z',
    updatedAt: '2026-07-17T12:00:00.000Z',
    classificationDispute: false,
    appealCount: 0,
  });
  assert.equal(status.phase, 'under_review');
  assert.equal('campaign' in status, false);
  assert.equal('spam' in status, false);
});

test('allows one appeal for rejected closures and classification disputes', () => {
  assert.equal(
    isAppealEligible({
      phase: 'closed',
      closureReason: 'rejected',
      classificationDispute: false,
      appealCount: 0,
    }),
    true,
  );
  assert.equal(
    isAppealEligible({
      phase: 'closed',
      classificationDispute: true,
      appealCount: 0,
    }),
    true,
  );
  assert.equal(
    isAppealEligible({
      phase: 'closed',
      closureReason: 'rejected',
      classificationDispute: false,
      appealCount: 1,
    }),
    false,
  );
});

test('maps resolved moderation to closed public phase', () => {
  assert.equal(mapModerationToPublicPhase('resolved'), 'closed');
});

test('carries a plain outcomeReason when a correction was declined', () => {
  const status = buildPublicCorrectionStatus({
    receiptCode: 'BB-COR-0123456789ABCDEF',
    moderationState: 'blocked',
    submittedAt: '2026-07-17T12:00:00.000Z',
    updatedAt: '2026-07-18T09:00:00.000Z',
    classificationDispute: false,
    closureReason: 'rejected',
    appealCount: 0,
  });
  assert.equal(status.phase, 'closed');
  assert.equal(status.outcomeReason, 'The record was not changed after review.');
});

test('omits outcomeReason for a published correction (resolved, not a decline)', () => {
  const status = buildPublicCorrectionStatus({
    receiptCode: 'BB-COR-0123456789ABCDEF',
    moderationState: 'resolved',
    submittedAt: '2026-07-17T12:00:00.000Z',
    updatedAt: '2026-07-18T09:00:00.000Z',
    classificationDispute: false,
    closureReason: 'resolved',
    appealCount: 0,
  });
  assert.equal(status.phase, 'closed');
  assert.equal('outcomeReason' in status, false);
});

test('omits outcomeReason for a still-open correction', () => {
  const status = buildPublicCorrectionStatus({
    receiptCode: 'BB-COR-0123456789ABCDEF',
    moderationState: 'pending_review',
    submittedAt: '2026-07-17T12:00:00.000Z',
    updatedAt: '2026-07-17T12:00:00.000Z',
    classificationDispute: false,
    appealCount: 0,
  });
  assert.equal(status.phase, 'received');
  assert.equal('outcomeReason' in status, false);
});
