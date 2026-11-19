import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCE_LABELS, sourceDisplayName } from './source-label';

const INTERNAL_ID = /^[a-z0-9]+(_[a-z0-9]+)+$/;

test('known source ids print their plain names', () => {
  assert.equal(sourceDisplayName('wikipedia_api'), 'Wikipedia');
  assert.equal(sourceDisplayName('Library of Congress'), 'Library of Congress');
});

test('an unnamed id falls back to the link host, then to words', () => {
  assert.equal(sourceDisplayName('some_feed', 'https://www.example.org/a'), 'example.org');
  assert.equal(sourceDisplayName('some_feed'), 'some feed');
});

test('no known id renders as an internal id', () => {
  for (const id of Object.keys(SOURCE_LABELS)) {
    assert.doesNotMatch(sourceDisplayName(id), INTERNAL_ID);
  }
});
