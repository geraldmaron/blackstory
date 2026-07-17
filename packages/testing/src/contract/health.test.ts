/**
 * Contract-layer tests for shared API health payload shape.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertHealthContract } from './health.ts';

test('assertHealthContract accepts ok payloads', () => {
  assert.deepEqual(assertHealthContract({ service: 'api-public', status: 'ok' }, 'api-public'), {
    service: 'api-public',
    status: 'ok',
  });
});

test('assertHealthContract rejects mismatched services', () => {
  assert.throws(
    () => assertHealthContract({ service: 'api-internal', status: 'ok' }, 'api-public'),
    /expected service/,
  );
});
