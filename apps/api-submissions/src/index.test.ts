/**
 * Smoke tests for the submissions API health contract.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { health } from './index.ts';

test('health reports api-submissions', () => {
  assert.equal(health().service, 'api-submissions');
});
