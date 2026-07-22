/**
 * Idempotency cache tests for correction submit retries.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIdempotencyCache } from './idempotency-cache.ts';

test('returns the same cached receipt for an identical idempotency key', () => {
  const cache = createIdempotencyCache();
  cache.set('bbcor-deadbeef00112233', {
    receiptCode: 'BB-COR-ABCDEF0123456789',
    statusHref: '/v1/corrections/status',
    submissionId: 'sub-1',
  });

  const hit = cache.get('bbcor-deadbeef00112233');
  assert.deepEqual(hit, {
    receiptCode: 'BB-COR-ABCDEF0123456789',
    statusHref: '/v1/corrections/status',
    submissionId: 'sub-1',
  });
  assert.equal(cache.get(''), undefined);
  assert.equal(cache.get('   '), undefined);
});
