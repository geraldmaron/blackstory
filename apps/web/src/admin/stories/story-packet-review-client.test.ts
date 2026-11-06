import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSingleReviewBody } from './story-packet-review-client';

test('buildSingleReviewBody omits a blank note', () => {
  assert.deepEqual(buildSingleReviewBody('approved', '   '), { decision: 'approved' });
  assert.deepEqual(buildSingleReviewBody('rejected', ''), { decision: 'rejected' });
});

test('buildSingleReviewBody sends the trimmed note', () => {
  assert.deepEqual(buildSingleReviewBody('needs_evidence', '  one more source  '), {
    decision: 'needs_evidence',
    note: 'one more source',
  });
});
