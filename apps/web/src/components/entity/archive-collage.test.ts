/**
 * Unit tests for archive collage shape selection and honest alt copy.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  archiveCollageAlt,
  selectArchiveCollageShape,
} from './archive-collage.ts';
import { collageTilesForEntity } from './archive-collage-tiles.ts';

test('selectArchiveCollageShape is stable for the same entity id', () => {
  const a = selectArchiveCollageShape('ent_example_001', 'person');
  const b = selectArchiveCollageShape('ent_example_001', 'person');
  assert.equal(a, b);
});

test('person kind stays in afro/fist/arch pool', () => {
  const shape = selectArchiveCollageShape('ent_person_xyz', 'person');
  assert.ok(['afro', 'fist', 'arch'].includes(shape));
});

test('place kind stays in pin/arch pool', () => {
  const shape = selectArchiveCollageShape('ent_place_xyz', 'place');
  assert.ok(['pin', 'arch'].includes(shape));
});

test('alt text refuses likeness framing', () => {
  const alt = archiveCollageAlt({ entityName: 'Test Person', shape: 'afro' });
  assert.match(alt, /not a photograph/i);
  assert.match(alt, /Test Person/);
  assert.match(alt, /afro/i);
});

test('collageTilesForEntity returns 16 rotating tiles', () => {
  const tiles = collageTilesForEntity('ent_a');
  assert.equal(tiles.length, 16);
  assert.equal(collageTilesForEntity('ent_a').join(), tiles.join());
  // Different entities usually rotate — not a hard assert on inequality, just length.
  assert.equal(collageTilesForEntity('ent_b').length, 16);
});
