import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatAgo } from './format-when';

const now = new Date('2026-11-10T12:00:00Z');

test('formatAgo reads in days and never goes negative', () => {
  assert.equal(formatAgo('2026-11-10T01:00:00Z', now), 'today');
  assert.equal(formatAgo('2026-11-12T00:00:00Z', now), 'today');
  assert.equal(formatAgo('2026-11-09T01:00:00Z', now), 'yesterday');
  assert.equal(formatAgo('2026-11-08T01:00:00Z', now), '2 days ago');
  assert.equal(formatAgo(null, now), '—');
});
