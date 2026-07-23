/**
 * Unit tests for catalog-derived history graph relationships.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildHistoryViewModel } from './history-view-model';
import { resolveHistoryRelationships } from './resolve-history-relationships';
import { HISTORY_GRAPH_GENERATED_AT } from '../../data/history-graph-seed';

test('resolveHistoryRelationships extracts evidence-backed edges from catalog related entries', () => {
  const entities = listPublicEntities();
  const relationships = resolveHistoryRelationships(entities, HISTORY_GRAPH_GENERATED_AT);
  assert.ok(relationships.length >= 3);
  for (const relationship of relationships) {
    assert.ok(relationship.evidenceIds.length > 0);
  }
});

test('history overview connection count follows visible published edges, not a hard cap', () => {
  const view = buildHistoryViewModel({});
  assert.equal(view.overview.totalConnections, view.edges.length);
  assert.ok(view.overview.totalConnections >= 3);
  assert.ok(
    view.nodes.some((node) => node.connectionCount > 0),
    'connected nodes should reflect edge inventory',
  );
});
