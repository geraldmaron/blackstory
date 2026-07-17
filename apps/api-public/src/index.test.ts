/**
 * Smoke tests for the public API health contract.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { health } from './index.ts';

test('health reports api-public', () => {
  assert.equal(health().service, 'api-public');
  assert.equal(health().status, 'ok');
});
