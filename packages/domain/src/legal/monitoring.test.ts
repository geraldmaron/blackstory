/**
 * Tests for legal change monitoring proposes review_queue events from adapter diffs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proposeLegalReviewEvents } from './monitoring.js';

test('proposeLegalReviewEvents emits events when change hash differs', () => {
  const events = proposeLegalReviewEvents({
    detectedAt: '2026-07-17T06:00:00.000Z',
    prior: [{ source: 'legiscan-free', externalId: '1900123', changeHash: 'old-hash' }],
    current: [
      {
        source: 'legiscan-free',
        externalId: '1900123',
        jurisdiction: 'us-10',
        title: 'Election Integrity Act of 2025',
        topics: ['voting'],
        changeHash: 'new-hash',
        sourceUrl: 'https://api.legiscan.com/?op=getBill&id=1900123',
        officialUrl: 'https://www.legis.ga.gov/legislation/71972',
        archivedCaptureUrl:
          'https://web.archive.org/web/20260717000000/https://www.legis.ga.gov/legislation/71972',
        diffHint: 'Bill status changed.',
        affectedSnapshotIds: ['legal-legiscan-1900123'],
      },
    ],
    eventTypeBySource: { 'legiscan-free': 'bill_status_change' },
  });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, 'bill_status_change');
  assert.equal(events[0]?.status, 'pending_review');
});

test('proposeLegalReviewEvents skips unchanged hashes', () => {
  const events = proposeLegalReviewEvents({
    detectedAt: '2026-07-17T06:00:00.000Z',
    prior: [
      { source: 'ecfr-versioner', externalId: 'title-42/part-1983', changeHash: '2026-01-01' },
    ],
    current: [
      {
        source: 'ecfr-versioner',
        externalId: 'title-42/part-1983',
        jurisdiction: 'us',
        title: 'Section 1983',
        topics: ['employment'],
        changeHash: '2026-01-01',
        sourceUrl: 'https://www.ecfr.gov/current/title-42/part-1983',
        archivedCaptureUrl:
          'https://web.archive.org/web/20260717000000/https://www.ecfr.gov/current/title-42/part-1983',
        affectedSnapshotIds: ['legal-ecfr-42-1983'],
      },
    ],
  });
  assert.equal(events.length, 0);
});
