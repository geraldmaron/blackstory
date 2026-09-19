/**
 * Unit tests for catalog-derived history graph relationships.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';
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
  const entities = releasedRelationshipFixtures();
  const relationships = resolveHistoryRelationships(entities, HISTORY_GRAPH_GENERATED_AT);
  assert.ok(relationships.length === 1);
  for (const relationship of relationships) {
    assert.ok(relationship.evidenceIds.length > 0);
  }
});

test('history graph connection count follows visible published edges, not a hard cap', () => {
  // Exercise the visible graph slice through its connection counts.
  const entities = releasedRelationshipFixtures();
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const artifact = getHistoryGraphReleaseArtifact(entities);
  const relationships = resolveHistoryRelationships(entities, HISTORY_GRAPH_GENERATED_AT);
  const slice = resolveHistoryGraphSlice(artifact, 'all-time', undefined);
  const nodes = buildHistoryNodes(slice, DEFAULT_HISTORY_FILTERS, entitiesById);
  const visibleNodeIds = new Set(nodes.map((node) => node.entityId));
  const edges = buildHistoryEdges(slice, relationships, entitiesById, visibleNodeIds);
  const nodesWithCounts = withHistoryConnectionCounts(nodes, edges);

  assert.ok(edges.length === 1);
  assert.ok(
    nodesWithCounts.some((node) => node.connectionCount > 0),
    'connected nodes should reflect edge inventory',
  );
});

function releasedRelationshipFixtures(): readonly PublicEntityView[] {
  const [first, second] = listPublicEntities();
  return [
    {
      ...first!,
      related: [{ id: second!.id, type: 'related_to', direction: 'outgoing' }],
      claims: [
        {
          id: 'reviewed-relationship-claim',
          predicate: 'related_to',
          object: second!.id,
          confidenceLevel: 'high',
          citationSource: 'archive',
          citationLabel: 'Exact relationship',
          citationHref: 'https://archive.example.org/relationship',
        },
      ],
    },
    { ...second!, related: [], claims: [] },
  ];
}

test('missing relationship evidence cannot trigger a seed fallback or borrow entity-wide citations', () => {
  const entities = releasedRelationshipFixtures().map((entity) => ({ ...entity, claims: [] }));
  assert.deepEqual(resolveHistoryRelationships(entities, HISTORY_GRAPH_GENERATED_AT), []);
  assert.deepEqual(getHistoryGraphReleaseArtifact(entities).allTimeView.edgeIds, []);
});
