/**
 * Unit tests for discovery mode parsing.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDiscoveryMode } from './mode.ts';

test('defaults to fixture when unset', () => {
  assert.equal(parseDiscoveryMode(undefined), 'fixture');
  assert.equal(parseDiscoveryMode(''), 'fixture');
  assert.equal(parseDiscoveryMode('  '), 'fixture');
});

test('accepts fixture and live', () => {
  assert.equal(parseDiscoveryMode('fixture'), 'fixture');
  assert.equal(parseDiscoveryMode('live'), 'live');
});

test('rejects unknown modes', () => {
  assert.throws(() => parseDiscoveryMode('prod'), /DISCOVERY_MODE/);
});
