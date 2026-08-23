/**
 * The compact edge catalog: decades are id lists into `allTime`, and slicing rebuilds exactly the
 * edges and line features the old per-decade copies carried.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import {
  pickExploreEdgeSlice,
  sliceExploreEdgeCatalog,
  type ExploreEdgeLineCatalog,
} from './explore-edge-catalog';
import { buildEdgeLineCatalog } from './explore-view-model';

const edge = (edgeId: string) =>
  ({
    edgeId,
    relationshipId: edgeId,
    type: 'located_at',
    fromEntityId: 'a',
    toEntityId: 'b',
    fromDisplayName: 'A',
    toDisplayName: 'B',
    evidenceCount: 1,
    citations: [],
  }) as unknown as ExploreEdgeLineCatalog['allTime']['edges'][number];

const line = (edgeId: string) =>
  ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
    properties: {
      edgeId,
      relationshipType: 'located_at',
      fromEntityId: 'a',
      toEntityId: 'b',
      fromDisplayName: 'A',
      toDisplayName: 'B',
      sentence: '',
      coincident: false,
    },
  }) as const;

const catalog: ExploreEdgeLineCatalog = {
  allTime: {
    edges: [edge('e1'), edge('e2'), edge('e3')],
    lineCollection: { type: 'FeatureCollection', features: [line('e1'), line('e2'), line('e3')] },
  },
  byDecade: { '1950s': ['e2'], '1960s': ['e1', 'e3'], '1970s': [] },
};

test('a decade slice is the all-time edges and lines filtered to that decade, in order', () => {
  const sixties = sliceExploreEdgeCatalog(catalog, '1960s');
  assert.deepEqual(
    sixties?.edges.map((e) => e.edgeId),
    ['e1', 'e3'],
  );
  assert.deepEqual(
    sixties?.lineCollection.features.map((f) => f.properties.edgeId),
    ['e1', 'e3'],
  );
  assert.equal(sliceExploreEdgeCatalog(catalog, '1970s')?.edges.length, 0);
  assert.equal(sliceExploreEdgeCatalog(catalog, '1840s'), undefined);
});

test('pickExploreEdgeSlice: lines off -> empty; unknown decade -> all time; known -> slice', () => {
  assert.equal(pickExploreEdgeSlice(catalog, { lines: false, decade: '1960s' }).edges.length, 0);
  assert.equal(pickExploreEdgeSlice(catalog, { lines: true }).edges.length, 3);
  assert.equal(pickExploreEdgeSlice(catalog, { lines: true, decade: '1840s' }).edges.length, 3);
  assert.equal(pickExploreEdgeSlice(catalog, { lines: true, decade: '1950s' }).edges.length, 1);
});

test('buildEdgeLineCatalog emits id lists whose every id exists in allTime', () => {
  const { edgeLineCatalog, availableDecades } = buildEdgeLineCatalog(undefined, listPublicEntities());
  const allTimeIds = new Set(edgeLineCatalog.allTime.edges.map((e) => e.edgeId));
  assert.ok(availableDecades.length > 0);
  for (const decade of availableDecades) {
    const ids = edgeLineCatalog.byDecade[decade];
    assert.ok(Array.isArray(ids), `decade ${decade} must be an id list`);
    for (const id of ids!) assert.ok(allTimeIds.has(id), `${decade}: ${id} not in allTime`);
  }
  // Line features are keyed by the same ids, so a slice can always find its lines.
  const lineIds = new Set(
    edgeLineCatalog.allTime.lineCollection.features.map((f) => f.properties.edgeId),
  );
  for (const id of allTimeIds) assert.ok(lineIds.has(id), `${id} has no line feature`);
});
