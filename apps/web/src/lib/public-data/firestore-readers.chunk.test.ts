/**
 * Guards the Firestore getAll chunk size used by thin entity point-get batches.
 * Mosaic rails (~232 tile ids) and dense neighbor sets must not issue a single
 * unbounded getAll RPC.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIRESTORE_GET_ALL_CHUNK_SIZE } from './firestore-readers';

test('FIRESTORE_GET_ALL_CHUNK_SIZE stays at the Firestore batchGet ceiling', () => {
  assert.equal(FIRESTORE_GET_ALL_CHUNK_SIZE, 100);
  assert.ok(FIRESTORE_GET_ALL_CHUNK_SIZE > 0);
  assert.ok(232 > FIRESTORE_GET_ALL_CHUNK_SIZE, 'mosaic tile set requires multi-chunk getAll');
});

test('chunk math covers mosaic-sized id lists without a remainder gap', () => {
  const mosaicSized = 232;
  const chunks = Math.ceil(mosaicSized / FIRESTORE_GET_ALL_CHUNK_SIZE);
  assert.equal(chunks, 3);
  const covered = chunks * FIRESTORE_GET_ALL_CHUNK_SIZE;
  assert.ok(covered >= mosaicSized);
});
