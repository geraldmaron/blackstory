/**
 * Unit tests for `/history` keyword search scoped to the public search index.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildHistoryViewModel } from './history-view-model';
import { applyHistorySearchFilter, rankHistorySearchEntityIds } from './history-search';
import { buildHistoryNodes, resolveHistoryGraphSlice } from './build-history-graph';
import { getHistoryGraphReleaseArtifact } from '../../data/history-graph-seed';
import { getSnapshotSearchIndex } from '../search/snapshot-search-index';

test('rankHistorySearchEntityIds matches display names within the scoped id set', () => {
  const entities = listPublicEntities();
  const artifact = getHistoryGraphReleaseArtifact(entities);
  const slice = resolveHistoryGraphSlice(artifact, 'all-time', undefined);
  const nodes = buildHistoryNodes(slice, { kind: 'all', q: '', sort: 'name', status: 'all', era: 'all', topic: 'all', connections: 'all' }, new Map(entities.map((entity) => [entity.id, entity])));
  const ranked = rankHistorySearchEntityIds(
    nodes.map((node) => node.entityId),
    'dunbar',
    getSnapshotSearchIndex(),
  );
  assert.ok(ranked.length >= 1);
  assert.ok(ranked.some((entityId) => entityId.includes('dunbar')));
});

test('applyHistorySearchFilter preserves relevance order from the search index', () => {
  const view = buildHistoryViewModel({ q: 'dunbar' });
  assert.ok(view.totalMatched >= 1);
  for (const node of view.nodes) {
    assert.match(`${node.displayName} ${node.summary}`.toLowerCase(), /dunbar|school|alumni|church|landmark/);
  }
});

test('applyHistorySearchFilter returns empty when nothing in slice matches', () => {
  const entities = listPublicEntities();
  const artifact = getHistoryGraphReleaseArtifact(entities);
  const slice = resolveHistoryGraphSlice(artifact, 'all-time', undefined);
  const nodes = buildHistoryNodes(slice, { kind: 'all', q: '', sort: 'name', status: 'all', era: 'all', topic: 'all', connections: 'all' }, new Map(entities.map((entity) => [entity.id, entity])));
  const filtered = applyHistorySearchFilter(nodes, 'zzzz-not-in-catalog-zzzz');
  assert.equal(filtered.length, 0);
});
