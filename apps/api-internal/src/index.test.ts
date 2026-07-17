/**
 * Smoke tests for the internal API health contract.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { health } from './index.ts';

test('health reports api-internal', () => {
  assert.equal(health().service, 'api-internal');
});
