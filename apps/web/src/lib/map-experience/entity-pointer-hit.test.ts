/**
 * Padded Explore pointer hits: unclustered pins win; clusters carry drill-in coordinates.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from '../../app/map/explore-layer-ids';
import {
  ENTITY_POINTER_HIT_PAD_PX,
  MAP_CLICK_TOLERANCE_PX,
  clusterSourceIdForLayer,
  entityIdFromProperties,
  pointerHitBox,
  resolveEntityPointerHit,
} from './entity-pointer-hit';

test('pointer hit box is a square pad around the click', () => {
  assert.deepEqual(pointerHitBox({ x: 100, y: 40 }), [
    [100 - ENTITY_POINTER_HIT_PAD_PX, 40 - ENTITY_POINTER_HIT_PAD_PX],
    [100 + ENTITY_POINTER_HIT_PAD_PX, 40 + ENTITY_POINTER_HIT_PAD_PX],
  ]);
  assert.equal(MAP_CLICK_TOLERANCE_PX, 12);
  assert.ok(MAP_CLICK_TOLERANCE_PX < ENTITY_POINTER_HIT_PAD_PX);
});

test('unclustered entityId wins when the pad also covers a cluster', () => {
  const hit = resolveEntityPointerHit([
    {
      layerId: EXPLORE_CLUSTER_LAYER_ID,
      properties: { cluster_id: 9, point_count: 12 },
    },
    {
      layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
      properties: { entityId: 'ent_dunbar_school_001' },
    },
  ]);
  assert.deepEqual(hit, { kind: 'entity', entityId: 'ent_dunbar_school_001' });
});

test('cluster hits carry the GeoJSON source that owns the cluster id', () => {
  assert.equal(clusterSourceIdForLayer(EXPLORE_CLUSTER_LAYER_ID), EXPLORE_ENTITIES_SOURCE_ID);
  assert.equal(
    clusterSourceIdForLayer(EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID),
    EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
  );
  const hit = resolveEntityPointerHit([
    {
      layerId: EXPLORE_CLUSTER_LAYER_ID,
      properties: { cluster_id: 4, point_count: 3 },
      coordinates: [-77.03, 38.89],
    },
  ]);
  assert.deepEqual(hit, {
    kind: 'cluster',
    clusterId: 4,
    sourceId: EXPLORE_ENTITIES_SOURCE_ID,
    center: [-77.03, 38.89],
  });
  assert.deepEqual(
    resolveEntityPointerHit([
      {
        layerId: EXPLORE_CLUSTER_LAYER_ID,
        properties: { cluster_id: '4', point_count: '3' },
        coordinates: [-77.03, 38.89],
      },
    ]),
    {
      kind: 'cluster',
      clusterId: 4,
      sourceId: EXPLORE_ENTITIES_SOURCE_ID,
      center: [-77.03, 38.89],
    },
  );
});

test('empty or nameless features do not select', () => {
  assert.equal(resolveEntityPointerHit([]), undefined);
  assert.equal(
    resolveEntityPointerHit([{ layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID, properties: {} }]),
    undefined,
  );
  assert.equal(entityIdFromProperties({ entityId: '' }), undefined);
  assert.equal(entityIdFromProperties({ entityId: 'ent_ok' }), 'ent_ok');
});

test('MapStage drills into clusters instead of opening a leaf record sheet', () => {
  const mapStage = readFileSync(
    fileURLToPath(new URL('../../components/map-stage/MapStage.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(mapStage, /handleEntityPointerClick/);
  assert.match(mapStage, /getClusterExpansionZoom/);
  assert.match(mapStage, /expandClusterFromPointerHit/);
  assert.match(mapStage, /notify\(listenersRef\.current, 'deselect'\)/);
  assert.doesNotMatch(mapStage, /getClusterLeaves/);
  assert.match(mapStage, /pointerHitBox/);
  assert.match(mapStage, /clickTolerance:\s*MAP_CLICK_TOLERANCE_PX/);
  assert.match(mapStage, /pointerHitAt\(event\.point\) \? 'pointer'/);
});
