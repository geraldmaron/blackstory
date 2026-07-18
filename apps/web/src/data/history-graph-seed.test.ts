/**
 * Regression tests for the graph release artifact seed used by `/history`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getHistoryGraphReleaseArtifact,
  HISTORY_GRAPH_RELEASE_ID,
  resetHistoryGraphReleaseArtifactForTests,
} from './history-graph-seed';

test.beforeEach(() => {
  resetHistoryGraphReleaseArtifactForTests();
});

test('builds a deterministic graph release artifact from public seed fixtures', () => {
  const first = getHistoryGraphReleaseArtifact();
  const second = getHistoryGraphReleaseArtifact();
  assert.equal(first.releaseId, HISTORY_GRAPH_RELEASE_ID);
  assert.equal(first.contentHash.digest, second.contentHash.digest);
  assert.ok(first.decadeViews.length > 0);
  assert.ok(first.allTimeView.nodeIds.length >= 4);
});

test('still-active entities appear in decades after their founding decade', () => {
  const artifact = getHistoryGraphReleaseArtifact();
  // The Dunbar Alumni Federation was founded in 2002 (the "2000s" decade); it must still appear
  // in a LATER decade too, proving the open-ended statusHistory record propagates forward rather
  // than being truncated at its founding decade.
  const twentyTwenties = artifact.decadeViews.find((view) => view.decade === '2020s');
  assert.ok(twentyTwenties);
  assert.ok(twentyTwenties!.nodeIds.includes('ent_dunbar_alumni_federation_001'));
});
