/**
 * Unit tests for projecting History edges to Explore map LineStrings.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HistoryEdgeView } from '../history/build-history-graph';
import { buildHistoryEdgeLineCollection } from './build-history-edge-lines';

function edge(
  partial: Partial<HistoryEdgeView> &
    Pick<HistoryEdgeView, 'edgeId' | 'fromEntityId' | 'toEntityId'>,
): HistoryEdgeView {
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
      edgeId: 'rel_dunbar_school_located_at_church',
      fromEntityId: 'ent_dunbar_school_001',
      toEntityId: 'ent_15th_st_church_001',
    }),
  ]);
  assert.equal(collection.features.length, 1);
  assert.equal(collection.features[0]?.properties.edgeId, 'rel_dunbar_school_located_at_church');
  assert.equal(collection.features[0]?.geometry.coordinates.length, 2);
  assert.equal(collection.features[0]?.properties.coincident, false);
});

test('nudges coincident campus endpoints so the segment is non-zero length', () => {
  const collection = buildHistoryEdgeLineCollection([
    edge({
      edgeId: 'rel_landmark_occurred_at_school',
      type: 'occurred_at',
      fromEntityId: 'ent_dc_landmark_listing_1975',
      toEntityId: 'ent_dunbar_school_001',
      sentence: 'Landmark listing occurred at School.',
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
      toEntityId: 'ent_15th_st_church_001',
    }),
  ]);
  assert.equal(collection.features.length, 0);
});

test('live catalog geoAnchor resolver draws lines for entities outside the seed table', () => {
  // Regression: national release entities carry geoAnchor on the projection; the seed-only
  // ENTITY_GEO_ANCHORS table never heard of them, so Lines ON painted 0 connections.
  const collection = buildHistoryEdgeLineCollection(
    [
      edge({
        edgeId: 'rel_live_a_located_at_live_b',
        fromEntityId: 'ent_live_catalog_a',
        toEntityId: 'ent_live_catalog_b',
      }),
    ],
    {
      geoAnchorFor: (id) => {
        if (id === 'ent_live_catalog_a') {
          return {
            lat: 33.75,
            lng: -84.39,
            geohash: 'dj',
            matchMethod: 'release_projection',
          };
        }
        if (id === 'ent_live_catalog_b') {
          return {
            lat: 29.76,
            lng: -95.37,
            geohash: '9v',
            matchMethod: 'release_projection',
          };
        }
        return undefined;
      },
    },
  );
  assert.equal(collection.features.length, 1);
  assert.deepEqual(collection.features[0]?.geometry.coordinates, [
    [-84.39, 33.75],
    [-95.37, 29.76],
  ]);
});

test('live resolver still falls back to the seed table for Dunbar fixtures', () => {
  const collection = buildHistoryEdgeLineCollection(
    [
      edge({
        edgeId: 'rel_dunbar_school_located_at_church',
        fromEntityId: 'ent_dunbar_school_001',
        toEntityId: 'ent_15th_st_church_001',
      }),
    ],
    { geoAnchorFor: () => undefined },
  );
  assert.equal(collection.features.length, 1);
});
