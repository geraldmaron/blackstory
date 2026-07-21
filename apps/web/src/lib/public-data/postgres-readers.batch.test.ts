/**
 * Guards the Postgres entity batch size used by thin entity point-get batches.
 * Mosaic rails (~232 tile ids) and dense neighbor sets must not issue a single
 * unbounded `= ANY($n::text[])` query.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POSTGRES_ENTITY_BATCH_SIZE } from './postgres-readers';

test('POSTGRES_ENTITY_BATCH_SIZE stays at the practical batch ceiling', () => {
  assert.equal(POSTGRES_ENTITY_BATCH_SIZE, 100);
  assert.ok(POSTGRES_ENTITY_BATCH_SIZE > 0);
  assert.ok(232 > POSTGRES_ENTITY_BATCH_SIZE, 'mosaic tile set requires multi-chunk entity reads');
});

test('chunk math covers mosaic-sized id lists without a remainder gap', () => {
  const mosaicSized = 232;
  const chunks = Math.ceil(mosaicSized / POSTGRES_ENTITY_BATCH_SIZE);
  assert.equal(chunks, 3);
  const covered = chunks * POSTGRES_ENTITY_BATCH_SIZE;
  assert.ok(covered >= mosaicSized);
});
