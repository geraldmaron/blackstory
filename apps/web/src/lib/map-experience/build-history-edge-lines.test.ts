/**
 * Unit tests for projecting History edges to Explore map LineStrings.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HistoryEdgeView } from '../history/build-history-graph';
import { buildHistoryEdgeLineCollection } from './build-history-edge-lines';

function edge(partial: Partial<HistoryEdgeView> & Pick<HistoryEdgeView, 'edgeId' | 'fromEntityId' | 'toEntityId'>): HistoryEdgeView {
  return {
    relationshipId: partial.edgeId,
    type: 'located_at',
    fromDisplayName: 'From',
    toDisplayName: 'To',
    evidenceCount: 1,
    citations: [],
    sentence: 'From is located at To.',
    ...partial,
  };
}

test('builds LineStrings for edges whose endpoints both have geo anchors', () => {
  const collection = buildHistoryEdgeLineCollection([
    edge({
      edgeId: 'rel_seed_school_located_at_place',
      fromEntityId: 'ent_seed_school_001',
      toEntityId: 'ent_seed_place_001',
    }),
  ]);
  assert.equal(collection.features.length, 1);
  assert.equal(collection.features[0]?.properties.edgeId, 'rel_seed_school_located_at_place');
  assert.equal(collection.features[0]?.geometry.coordinates.length, 2);
  assert.equal(collection.features[0]?.properties.coincident, false);
});

test('nudges coincident campus endpoints so the segment is non-zero length', () => {
  const collection = buildHistoryEdgeLineCollection([
    edge({
      edgeId: 'rel_seed_event_occurred_at_school',
      type: 'occurred_at',
      fromEntityId: 'ent_seed_event_001',
      toEntityId: 'ent_seed_school_001',
      sentence: 'Event occurred at School.',
    }),
  ]);
  assert.equal(collection.features.length, 1);
  const [a, b] = collection.features[0]!.geometry.coordinates;
  assert.equal(collection.features[0]?.properties.coincident, true);
  assert.notEqual(a[0], b[0]);
});

test('skips edges when either endpoint lacks a geo anchor', () => {
  const collection = buildHistoryEdgeLineCollection([
    edge({
      edgeId: 'rel_missing',
      fromEntityId: 'ent_unknown_from',
      toEntityId: 'ent_seed_place_001',
    }),
  ]);
  assert.equal(collection.features.length, 0);
});
