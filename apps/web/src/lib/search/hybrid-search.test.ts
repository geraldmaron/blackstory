/**
 * Tests for snapshot vector lane and web hybrid wiring.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSnapshotSearchIndex, resetSnapshotSearchIndexCache } from './snapshot-search-index';
import { buildSnapshotVectorIndex, createSnapshotVectorLane, deterministicTextEmbedding } from './snapshot-vector-lane';
import { readHybridFlagFromParams, runWebHybridSearch } from './hybrid-search';

test('deterministicTextEmbedding is stable', () => {
  const first = deterministicTextEmbedding('rosewood school');
  const second = deterministicTextEmbedding('rosewood school');
  assert.deepEqual(first, second);
});

test('snapshot vector index covers every search doc', () => {
  resetSnapshotSearchIndexCache();
  const index = getSnapshotSearchIndex();
  const vectors = buildSnapshotVectorIndex(index);
  assert.equal(vectors.length, index.length);
});

test('runWebHybridSearch uses structured-only without hybrid flag', async () => {
  resetSnapshotSearchIndexCache();
  const response = await runWebHybridSearch({
    normalizedQuery: 'freedmen',
    filters: [],
    sort: 'relevance',
    offset: 0,
    pageSize: 10,
  });
  assert.ok(response.result.totalMatched >= 1);
  assert.equal(response.telemetry, undefined);
});

test('runWebHybridSearch activates hybrid mode with hybrid=1', async () => {
  resetSnapshotSearchIndexCache();
  const response = await runWebHybridSearch(
    {
      normalizedQuery: 'freedmen',
      filters: [],
      sort: 'relevance',
      offset: 0,
      pageSize: 10,
    },
    { hybridFlag: '1' },
  );
  assert.ok(response.telemetry);
  assert.ok(['hybrid', 'structured_only'].includes(response.telemetry!.mode));
});

test('runWebHybridSearch reports degraded when vector lane unavailable', async () => {
  resetSnapshotSearchIndexCache();
  const response = await runWebHybridSearch(
    {
      normalizedQuery: 'freedmen',
      filters: [],
      sort: 'relevance',
      offset: 0,
      pageSize: 10,
    },
    { hybridFlag: '1', vectorLaneUnavailable: true },
  );
  assert.equal(response.telemetry?.degraded, true);
  assert.equal(response.telemetry?.mode, 'structured_only');
});

test('readHybridFlagFromParams reads hybrid query param', () => {
  const params = new URLSearchParams('q=school&hybrid=1');
  assert.equal(readHybridFlagFromParams(params), '1');
});

test('createSnapshotVectorLane applies era pre-filter', () => {
  resetSnapshotSearchIndexCache();
  const index = getSnapshotSearchIndex();
  const lane = createSnapshotVectorLane(index);
  const result = lane.findNearest({
    normalizedQuery: 'education',
    filters: [],
    eraBucket: '1900s',
    limit: 20,
  });
  assert.equal(result.status, 'ok');
  for (const match of result.matches) {
    const doc = index.find((d) => d.id === match.entityId);
    assert.ok(doc?.eraBuckets.includes('1900s'));
  }
});
