/**
 * Tests for review_queue event shape, dedupe, and fail-closed archive gate.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertLegalReviewQueueEventValid,
  dedupeReviewQueueEvents,
  reviewQueueDedupeKey,
} from './review-queue.js';
import type { LegalReviewQueueEvent } from './review-queue.js';

const BASE_EVENT: LegalReviewQueueEvent = {
  source: 'congress-gov-v3',
  eventType: 'became_law',
  jurisdiction: 'us',
  topic: ['voting'],
  externalId: '89/pub/110',
  title: 'Voting Rights Act of 1965',
  summarySnippet: 'New public law detected.',
  detectedAt: '2026-07-17T06:00:00.000Z',
  evidence: {
    sourceUrl: 'https://api.congress.gov/v3/law/89/pub/110',
    archivedCaptureUrl: 'https://web.archive.org/web/20260717000000/https://api.congress.gov/v3/law/89/pub/110',
    changeHashNew: 'hash-v2',
  },
  proposedAction: 'Review and update snapshot.',
  affectedEntries: ['legal-cra-1964'],
  confidence: 'high',
  status: 'pending_review',
};

test('review queue dedupe key combines source, external id, and new hash', () => {
  assert.equal(reviewQueueDedupeKey(BASE_EVENT), 'congress-gov-v3:89/pub/110:hash-v2');
});

test('dedupeReviewQueueEvents drops duplicate keys', () => {
  const unique = dedupeReviewQueueEvents([BASE_EVENT, BASE_EVENT], new Set());
  assert.equal(unique.length, 1);
});

test('pending_review events require archived capture', () => {
  const invalid = {
    ...BASE_EVENT,
    evidence: { ...BASE_EVENT.evidence, archivedCaptureUrl: '' },
  };
  assert.throws(() => assertLegalReviewQueueEventValid(invalid), /archivedCaptureUrl/);
});
