import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changedRowIds } from './preflight-drift.ts';

const live = { entity_id: 'a', summary: 'old', claims: [{ id: 'c1' }] };

test('changedRowIds: unchanged rows are not reported', () => {
  assert.deepEqual(changedRowIds(['a'], [live], [{ ...live, claims: [{ id: 'c1' }] }]), []);
});

test('changedRowIds: a correction committed after preflight is reported', () => {
  assert.deepEqual(changedRowIds(['a'], [live], [{ ...live, summary: 'corrected' }]), ['a']);
});

test('changedRowIds: a retraction recorded after preflight is reported', () => {
  const retraction = { entity_id: 'a', decision: 'flag_for_retraction', reason: 'r' };
  assert.deepEqual(changedRowIds(['a', 'b'], [], [retraction]), ['a']);
});

test('changedRowIds: a row deleted after preflight is reported', () => {
  assert.deepEqual(changedRowIds(['a'], [live], []), ['a']);
});

test('changedRowIds: rows outside the id list are ignored', () => {
  assert.deepEqual(changedRowIds(['b'], [live], [{ ...live, summary: 'x' }]), []);
});
