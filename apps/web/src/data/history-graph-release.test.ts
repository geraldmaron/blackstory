/**
 * Tests for stored release graph reader + in-process fallback flag.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { historyGraphInProcessFallbackEnabled } from '../lib/public-data/release-graph-readers';
import {
  getHistoryGraphReleaseArtifact,
  resolveHistoryGraphReleaseArtifact,
  resetHistoryGraphReleaseArtifactForTests,
} from './history-graph-seed';
import { listPublicEntities } from './public-seed';

test.beforeEach(() => {
  resetHistoryGraphReleaseArtifactForTests();
});

test('historyGraphInProcessFallbackEnabled respects HISTORY_GRAPH_IN_PROCESS_FALLBACK', () => {
  const prior = process.env.HISTORY_GRAPH_IN_PROCESS_FALLBACK;
  process.env.HISTORY_GRAPH_IN_PROCESS_FALLBACK = '1';
  assert.equal(historyGraphInProcessFallbackEnabled(), true);
  delete process.env.HISTORY_GRAPH_IN_PROCESS_FALLBACK;
  assert.equal(historyGraphInProcessFallbackEnabled(), false);
  if (prior !== undefined) process.env.HISTORY_GRAPH_IN_PROCESS_FALLBACK = prior;
});

test('resolveHistoryGraphReleaseArtifact falls back to in-process build for seed release', async () => {
  const entities = listPublicEntities();
  const stored = await resolveHistoryGraphReleaseArtifact(entities, {
    releaseId: 'seed-snapshot',
  });
  const built = getHistoryGraphReleaseArtifact(entities);
  assert.equal(stored.contentHash.digest, built.contentHash.digest);
});

test('the memo key is order-insensitive but still separates different catalogs', () => {
  // catalogCacheKey is module-private, so this exercises it through the memo it feeds.
  // It used to sort every id with localeCompare and join them into a ~100KB string on every
  // request to `/`. The replacement is an XOR-fold, which is commutative and therefore
  // order-insensitive without paying for a sort. Both properties matter: order-insensitivity is
  // what the sort was for, and distinctness is what stops one catalog serving another's graph.
  const entities = listPublicEntities();
  assert.ok(entities.length >= 3, 'seed catalog needs a few entities for this to mean anything');

  const forward = getHistoryGraphReleaseArtifact(entities);
  const reversed = getHistoryGraphReleaseArtifact([...entities].reverse());
  assert.equal(reversed, forward, 'a reordered catalog must hit the same memo entry');

  const subset = getHistoryGraphReleaseArtifact(entities.slice(0, entities.length - 1));
  assert.notEqual(subset, forward, 'a different catalog must not reuse the memo entry');
});
