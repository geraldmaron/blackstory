/**
 * Unit tests for catalog-derived history graph relationships.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import {
  getHistoryGraphReleaseArtifact,
  resetHistoryGraphReleaseArtifactForTests,
  HISTORY_GRAPH_GENERATED_AT,
} from '../../data/history-graph-seed';
import {
  buildHistoryEdges,
  buildHistoryNodes,
  resolveHistoryGraphSlice,
  withHistoryConnectionCounts,
} from './build-history-graph';
import { DEFAULT_HISTORY_FILTERS } from './filters';
import { resolveHistoryRelationships } from './resolve-history-relationships';

test.beforeEach(() => {
  resetHistoryGraphReleaseArtifactForTests();
});

test('resolveHistoryRelationships extracts evidence-backed edges from catalog related entries', () => {
  const entities = listPublicEntities();
  const relationships = resolveHistoryRelationships(entities, HISTORY_GRAPH_GENERATED_AT);
  assert.ok(relationships.length >= 3);
  for (const relationship of relationships) {
    assert.ok(relationship.evidenceIds.length > 0);
  }
});

test('history graph connection count follows visible published edges, not a hard cap', () => {
  // The same slice -> nodes -> edges -> connection-count pipeline Explore reads (build-history-graph
  // via explore-view-model), rather than the deleted /history/api view-model chain (repo-92n2.36).
  const entities = listPublicEntities();
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const artifact = getHistoryGraphReleaseArtifact();
  const relationships = resolveHistoryRelationships(entities, HISTORY_GRAPH_GENERATED_AT);
  const slice = resolveHistoryGraphSlice(artifact, 'all-time', undefined);
  const nodes = buildHistoryNodes(slice, DEFAULT_HISTORY_FILTERS, entitiesById);
  const visibleNodeIds = new Set(nodes.map((node) => node.entityId));
  const edges = buildHistoryEdges(slice, relationships, entitiesById, visibleNodeIds);
  const nodesWithCounts = withHistoryConnectionCounts(nodes, edges);

  assert.ok(edges.length >= 3);
  assert.ok(
    nodesWithCounts.some((node) => node.connectionCount > 0),
    'connected nodes should reflect edge inventory',
  );
});
