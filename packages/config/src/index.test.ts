/**
 * Smoke tests for @black-book/config environment helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNodeEnv, parseRuntimeEnvironment, packageNameSchema } from './index.ts';

test('parseNodeEnv defaults to development', () => {
  assert.equal(parseNodeEnv(undefined), 'development');
});

test('parseNodeEnv accepts production', () => {
  assert.equal(parseNodeEnv('production'), 'production');
});

test('packageNameSchema accepts scoped package names', () => {
  assert.equal(packageNameSchema.parse('@black-book/config'), '@black-book/config');
});

test('local runtime environment does not require production variables', () => {
  assert.deepEqual(parseRuntimeEnvironment({ NODE_ENV: 'test' }), {
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
  });
});

test('runtime environment rejects unsupported log levels', () => {
  assert.throws(() => parseRuntimeEnvironment({ LOG_LEVEL: 'verbose' }));
});
