/**
 * Unit tests for geometric-only atmosphere plane selection.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectAtmospherePlane } from './select-atmosphere-plane';

test('selectAtmospherePlane is stable for the same seed key', () => {
  const a = selectAtmospherePlane({ seedKey: 'basement-to-m-street' });
  const b = selectAtmospherePlane({ seedKey: 'basement-to-m-street' });
  assert.equal(a.planeId, b.planeId);
  assert.equal(a.mode, 'geometric');
  assert.equal(a.tiles.length, 0);
  assert.equal(a.geometric.id, b.geometric.id);
});

test('selectAtmospherePlane always returns geometric mode with empty tiles', () => {
  const selection = selectAtmospherePlane({ seedKey: 'naming-dunbar-1916' });
  assert.equal(selection.mode, 'geometric');
  assert.equal(selection.tiles.length, 0);
  assert.ok(selection.geometric.path.startsWith('/brand/atmosphere/fallback/'));
});

test('preferGeometric is accepted but still returns geometric mode', () => {
  const selection = selectAtmospherePlane({
    seedKey: 'same-footprint-new-walls',
    preferGeometric: true,
  });
  assert.equal(selection.mode, 'geometric');
  assert.equal(selection.tiles.length, 0);
});

test('planeId is a stable hex hash prefix', () => {
  const selection = selectAtmospherePlane({ seedKey: 'alumni-keep-the-thread' });
  assert.match(selection.planeId, /^atm-[0-9a-f]+$/);
});

test('different seed keys usually pick different geometric patterns', () => {
  const a = selectAtmospherePlane({ seedKey: 'slug-a' });
  const b = selectAtmospherePlane({ seedKey: 'slug-b' });
  // Collision possible but rare across FNV of distinct slugs.
  assert.notEqual(a.planeId, b.planeId);
});
