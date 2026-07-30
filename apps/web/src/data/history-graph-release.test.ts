/**
 * Tests for stored release graph reader + in-process fallback flag.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  historyGraphInProcessFallbackEnabled,
} from '../lib/public-data/release-graph-readers';
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
