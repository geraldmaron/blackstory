/**
 * Unit tests for ops dashboard counting helpers (pure logic, no I/O).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countPendingStoryPackets } from './ops-summary.ts';

test('countPendingStoryPackets counts items without review', () => {
  const result = countPendingStoryPackets([
    { review: undefined },
    {
      review: {
        decision: 'approved',
        reviewedAt: '2026-07-01T00:00:00.000Z',
        reviewedByEmail: 'ops@example.com',
      },
    },
    { review: undefined },
    {
      review: {
        decision: 'rejected',
        reviewedAt: '2026-07-02T00:00:00.000Z',
        reviewedByEmail: 'ops@example.com',
      },
    },
  ]);
  assert.equal(result.pending, 2);
  assert.equal(result.total, 4);
});

test('countPendingStoryPackets returns zero pending for empty list', () => {
  const result = countPendingStoryPackets([]);
  assert.equal(result.pending, 0);
  assert.equal(result.total, 0);
});

test('countPendingStoryPackets treats all reviewed items as not pending', () => {
  const result = countPendingStoryPackets([
    {
      review: {
        decision: 'needs_evidence',
        reviewedAt: '2026-07-03T00:00:00.000Z',
        reviewedByEmail: 'ops@example.com',
      },
    },
  ]);
  assert.equal(result.pending, 0);
  assert.equal(result.total, 1);
});
