import assert from 'node:assert/strict';
import { test } from 'node:test';
import { followSelectedBlock } from './follow-block';

const a = { type: 'stat', id: 'a' };
const b = { type: 'paragraph', text: 'b' };
const c = { type: 'image', id: 'c' };

test('a block edited in place keeps its index', () => {
  assert.equal(followSelectedBlock([a, b, c], [a, b, { ...c, alt: 'x' }], 2), 2);
  assert.equal(followSelectedBlock([a, b, c], [a, { ...b, text: 'bb' }, c], 2), 2);
});

test('a moved block is followed to its new index', () => {
  assert.equal(followSelectedBlock([a, b, c], [a, c, b], 2), 1);
  assert.equal(followSelectedBlock([a, b, c], [b, c], 2), 1);
});

test('a removed or duplicated block clears the selection instead of guessing', () => {
  assert.equal(followSelectedBlock([a, b, c], [a, b], 2), null);
  assert.equal(followSelectedBlock([a, b, c], [c, a, b, c], 2), null);
  assert.equal(followSelectedBlock([a], [a], null), null);
});
