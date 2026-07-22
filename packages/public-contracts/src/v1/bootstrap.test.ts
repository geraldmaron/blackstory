import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from '../testing/load-fixture.js';
import { bootstrapResponseV1Schema } from './bootstrap.js';

test('round-trips a valid bootstrap response', () => {
  const fixture = loadFixture<Record<string, unknown>>('bootstrap.v1.current.json');
  assert.deepEqual(bootstrapResponseV1Schema.parse(fixture), fixture);
});

test('accepts a bootstrap response with searchIndexVersion/contentVersion absent (N-1 shape)', () => {
  const fixture = loadFixture<Record<string, unknown>>('bootstrap.v1.current.json');
  const { searchIndexVersion: _searchIndexVersion, contentVersion: _contentVersion, ...legacyShape } = fixture;
  assert.deepEqual(bootstrapResponseV1Schema.parse(legacyShape), legacyShape);
});

test('rejects an apiVersion other than the literal "v1" (version-skew guard)', () => {
  const fixture = loadFixture<Record<string, unknown>>('bootstrap.v1.current.json');
  assert.throws(() => bootstrapResponseV1Schema.parse({ ...fixture, apiVersion: 'v2' }));
});
