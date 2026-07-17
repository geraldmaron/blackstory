/**
 * Regression tests for the BB-092 graph release artifact seed used by `/history`.
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
  const seventies = artifact.decadeViews.find((view) => view.decade === '1970s');
  assert.ok(seventies);
  assert.ok(seventies!.nodeIds.includes('ent_seed_institution_001'));
});
