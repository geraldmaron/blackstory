/**
 * Padded Explore pointer hits: record discs win; place tokens carry their key and extent.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from '../../app/map/explore-layer-ids';
import {
  ENTITY_POINTER_HIT_PAD_PX,
  MAP_CLICK_TOLERANCE_PX,
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

test('a record disc wins when the pad also covers a place token', () => {
  const hit = resolveEntityPointerHit([
    {
      layerId: EXPLORE_CLUSTER_LAYER_ID,
      properties: {
        placeKey: 'city-dc-washington',
        level: 'city',
        point_count: 312,
        west: -77.1,
        south: 38.8,
        east: -76.9,
        north: 39,
      },
    },
    {
      layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
      properties: { entityId: 'ent_dunbar_school_001' },
    },
  ]);
  assert.deepEqual(hit, { kind: 'entity', entityId: 'ent_dunbar_school_001' });
});

test('place token hits carry the place key, level and member extent', () => {
  const hit = resolveEntityPointerHit([
    {
      layerId: EXPLORE_CLUSTER_LAYER_ID,
      properties: {
        placeKey: 'city-dc-washington',
        level: 'city',
        point_count: 312,
        west: -77.1,
        south: 38.8,
        east: -76.9,
        north: 39,
      },
    },
  ]);
  assert.deepEqual(hit, {
    kind: 'place',
    placeKey: 'city-dc-washington',
    level: 'city',
    bounds: [-77.1, 38.8, -76.9, 39],
  });
  // A malformed token (no extent, unknown level) is not a hit.
  assert.equal(
    resolveEntityPointerHit([
      { properties: { placeKey: 'state-ga', level: 'state', point_count: 3 } },
      {
        properties: {
          placeKey: 'x',
          level: 'planet',
          point_count: 3,
          west: 0,
          south: 0,
          east: 1,
          north: 1,
        },
      },
    ]),
    undefined,
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

test('MapStage drills into places instead of opening a leaf record sheet', () => {
  const mapStage = readFileSync(
    fileURLToPath(new URL('../../components/map-stage/MapStage.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(mapStage, /handleEntityPointerClick/);
  assert.match(mapStage, /drillIntoPlace/);
  assert.match(mapStage, /notify\(listenersRef\.current, 'placeSelect', hit\.placeKey\)/);
  assert.match(mapStage, /notify\(listenersRef\.current, 'deselect'\)/);
  assert.doesNotMatch(mapStage, /getClusterLeaves/);
  assert.match(mapStage, /pointerHitBox/);
  assert.match(mapStage, /clickTolerance:\s*MAP_CLICK_TOLERANCE_PX/);
  // The cursor and the pin hover card both come from the same padded hit as selection.
  assert.match(
    mapStage,
    /const hit = pointerHitAt\(event\.point\);\s*activeMap\.getCanvas\(\)\.style\.cursor = hit \? 'pointer'/,
  );
});

test('overlapping pins remain individually reachable without duplicate halo hits', () => {
  assert.deepEqual(
    resolveEntityPointerHit([
      { properties: { entityId: 'school' } },
      { properties: { entityId: 'school' } },
      { properties: { entityId: 'namesake' } },
    ]),
    { kind: 'overlap', entityIds: ['school', 'namesake'] },
  );
  assert.deepEqual(
    resolveEntityPointerHit([
      { properties: { entityId: 'school' } },
      { properties: { entityId: 'school' } },
    ]),
    { kind: 'entity', entityId: 'school' },
  );
});

test('the disc under the pointer wins over its neighbors in the padded box', () => {
  assert.deepEqual(
    resolveEntityPointerHit([
      { properties: { entityId: 'near' }, offsetPx: 14 },
      { properties: { entityId: 'under' }, offsetPx: 2 },
      { properties: { entityId: 'edge' }, offsetPx: 8 },
    ]),
    { kind: 'entity', entityId: 'under' },
  );
  // Stacked discs, the same distance away, still ask, and only about themselves.
  assert.deepEqual(
    resolveEntityPointerHit([
      { properties: { entityId: 'a' }, offsetPx: 3 },
      { properties: { entityId: 'b' }, offsetPx: 4 },
      { properties: { entityId: 'neighbor' }, offsetPx: 8 },
      { properties: { entityId: 'far' }, offsetPx: 15 },
    ]),
    { kind: 'overlap', entityIds: ['a', 'b'] },
  );
  // A near miss with no disc under the pointer keeps the padded answer.
  assert.deepEqual(
    resolveEntityPointerHit([
      { properties: { entityId: 'a' }, offsetPx: 12 },
      { properties: { entityId: 'b' }, offsetPx: 15 },
    ]),
    { kind: 'overlap', entityIds: ['a', 'b'] },
  );
});
