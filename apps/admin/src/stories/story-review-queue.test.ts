/**
 * Tests for story review queue filter, sort, and bulk selection helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_STORY_REVIEW_QUERY,
  applyStoryReviewQueue,
  assertStoryBulkSelection,
  countStoryReviewQueue,
  type StoryReviewQueueItem,
} from './story-review-queue.ts';

function item(
  partial: Partial<StoryReviewQueueItem> & Pick<StoryReviewQueueItem, 'submissionId' | 'title'>,
): StoryReviewQueueItem {
  return {
    createdAt: partial.createdAt ?? '2026-07-01T00:00:00.000Z',
    decision: partial.decision ?? 'recommend',
    topicId: partial.topicId ?? 'topic-1',
    validationIssueCount: partial.validationIssueCount ?? 0,
    review: partial.review ?? null,
    packet: partial.packet ?? { draft: { dek: 'A dek' } },
    submissionId: partial.submissionId,
    title: partial.title,
  };
}

const SAMPLE: readonly StoryReviewQueueItem[] = [
  item({
    submissionId: 'a',
    title: 'Alamo before the cry',
    createdAt: '2026-07-03T00:00:00.000Z',
    decision: 'recommend',
    validationIssueCount: 2,
  }),
  item({
    submissionId: 'b',
    title: 'Buffalo Soldiers',
    createdAt: '2026-07-02T00:00:00.000Z',
    decision: 'needs_evidence',
    review: { decision: 'approved' },
  }),
  item({
    submissionId: 'c',
    title: 'Chicago Bronzeville',
    createdAt: '2026-07-01T00:00:00.000Z',
    decision: 'reject',
    review: { decision: 'rejected' },
    validationIssueCount: 1,
  }),
];

test('default queue shows pending packets only, newest first', () => {
  const visible = applyStoryReviewQueue(SAMPLE, DEFAULT_STORY_REVIEW_QUERY);
  assert.deepEqual(
    visible.map((row) => row.submissionId),
    ['a'],
  );
});

test('filters by packet decision, issues, and search', () => {
  const byDecision = applyStoryReviewQueue(SAMPLE, {
    ...DEFAULT_STORY_REVIEW_QUERY,
    reviewStatus: 'all',
    packetDecision: 'reject',
  });
  assert.deepEqual(
    byDecision.map((row) => row.submissionId),
    ['c'],
  );

  const issues = applyStoryReviewQueue(SAMPLE, {
    ...DEFAULT_STORY_REVIEW_QUERY,
    reviewStatus: 'all',
    issuesOnly: true,
  });
  assert.deepEqual(
    issues.map((row) => row.submissionId),
    ['a', 'c'],
  );

  const search = applyStoryReviewQueue(SAMPLE, {
    ...DEFAULT_STORY_REVIEW_QUERY,
    reviewStatus: 'all',
    search: 'bronzeville',
  });
  assert.deepEqual(
    search.map((row) => row.submissionId),
    ['c'],
  );
});

test('sorts by title ascending', () => {
  const sorted = applyStoryReviewQueue(SAMPLE, {
    ...DEFAULT_STORY_REVIEW_QUERY,
    reviewStatus: 'all',
    sortKey: 'title',
    sortDirection: 'asc',
  });
  assert.deepEqual(
    sorted.map((row) => row.title),
    ['Alamo before the cry', 'Buffalo Soldiers', 'Chicago Bronzeville'],
  );
});

test('counts summarize the full inbox', () => {
  assert.deepEqual(countStoryReviewQueue(SAMPLE), {
    total: 3,
    pending: 1,
    approved: 1,
    rejected: 1,
    needsEvidence: 0,
    withIssues: 2,
  });
});

test('bulk selection enforces non-empty unique capped ids', () => {
  assert.deepEqual(assertStoryBulkSelection(['a', 'b']), ['a', 'b']);
  assert.throws(() => assertStoryBulkSelection([]), /at least one/);
  assert.throws(() => assertStoryBulkSelection(['a', 'a']), /duplicate/);
  assert.throws(
    () => assertStoryBulkSelection(Array.from({ length: 51 }, (_, i) => `id-${i}`)),
    /limited to 50/,
  );
});
