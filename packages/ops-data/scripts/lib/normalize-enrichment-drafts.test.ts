/**
 * Unit tests for post-enrichment draft normalization used before auto-promote
 * and rejudge publish-eligibility checks.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterRegisteredTopicIds,
  normalizeEraBuckets,
  normalizeEnrichmentDrafts,
  trimPublicSummary,
} from './normalize-enrichment-drafts.ts';

test('trimPublicSummary keeps text within 400 chars at a sentence boundary', () => {
  const padding = 'Documented evidence from municipal and federal sources anchors this place record. ';
  const summary = padding.repeat(5) + 'Final sentence exceeds the limit and must be removed.';
  assert.ok(summary.length > 400);
  const trimmed = trimPublicSummary(summary);
  assert.ok(trimmed.length <= 400);
  assert.match(trimmed, /anchors this place record\./u);
  assert.doesNotMatch(trimmed, /Final sentence exceeds/u);
});

test('trimPublicSummary returns short summaries unchanged', () => {
  const summary = 'A concise, evidence-led summary within the publication window.';
  assert.equal(trimPublicSummary(summary), summary);
});

test('normalizeEraBuckets expands decade-range labels', () => {
  assert.deepEqual(normalizeEraBuckets(['1960s-70s']), ['1960s', '1970s']);
  assert.deepEqual(normalizeEraBuckets(['1910s-20s']), ['1910s', '1920s']);
  assert.deepEqual(normalizeEraBuckets(['1960s–1970s']), ['1960s', '1970s']);
  assert.deepEqual(normalizeEraBuckets(['1950s', '1960s-70s']), ['1950s', '1960s', '1970s']);
});

test('normalizeEraBuckets drops invalid bucket labels', () => {
  assert.deepEqual(normalizeEraBuckets(['1960s', 'mid-century', '1970s']), ['1960s', '1970s']);
});

test('filterRegisteredTopicIds keeps only registry members', () => {
  const filtered = filterRegisteredTopicIds(['church', 'not-a-real-topic', 'civil-rights']);
  assert.deepEqual(filtered, ['church', 'civil-rights']);
});

test('normalizeEnrichmentDrafts applies all field normalizers', () => {
  const longSummary = `${'A'.repeat(350)}. Tail sentence that should be removed because it exceeds the limit.`;
  const normalized = normalizeEnrichmentDrafts({
    publicSummary: longSummary,
    eraBuckets: ['1960s-70s'],
    topicIds: ['church', 'fake-topic'],
  });
  assert.ok((normalized.publicSummary?.length ?? 0) <= 400);
  assert.deepEqual(normalized.eraBuckets, ['1960s', '1970s']);
  assert.deepEqual(normalized.topicIds, ['church']);
});
