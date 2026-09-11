import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertCatalogBulkSelection, CATALOG_DECISION_ACTIONS } from './catalog-decisions-store';

test('bulk catalog selection enforces non-empty unique capped ids', () => {
  assert.deepEqual(assertCatalogBulkSelection(['ent_a', 'ent_b']), ['ent_a', 'ent_b']);
  assert.throws(() => assertCatalogBulkSelection([]), /at least one/);
  assert.throws(() => assertCatalogBulkSelection(['ent_a', 'ent_a']), /duplicate/);
  assert.throws(
    () => assertCatalogBulkSelection(Array.from({ length: 51 }, (_, i) => `ent_${i}`)),
    /limited to 50/,
  );
});

test('catalog decision actions are exactly flag/needs-review/clear', () => {
  assert.deepEqual([...CATALOG_DECISION_ACTIONS].sort(), [
    'clear_flag',
    'flag_for_retraction',
    'needs_review',
  ]);
});
