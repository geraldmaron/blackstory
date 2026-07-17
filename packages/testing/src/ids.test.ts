/**
 * Unit tests for deterministic ID factories.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIdFactory } from './ids.ts';

test('createIdFactory emits padded sequential identifiers', () => {
  const ids = createIdFactory('ent');
  assert.equal(ids.next(), 'ent_0001');
  assert.equal(ids.peek(), 'ent_0002');
  assert.equal(ids.next(), 'ent_0002');
});

test('createIdFactory reset restores the counter', () => {
  const ids = createIdFactory('clm', 5, 2);
  assert.equal(ids.next(), 'clm_05');
  ids.reset();
  assert.equal(ids.next(), 'clm_05');
});

test('createIdFactory rejects empty prefixes', () => {
  assert.throws(() => createIdFactory(''), /prefix/);
});
