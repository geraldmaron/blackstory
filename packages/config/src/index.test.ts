/**
 * Smoke tests for @repo/config environment and identity helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseNodeEnv,
  parseRuntimeEnvironment,
  packageNameSchema,
  PRODUCT_NAME,
  PACKAGE_SCOPE,
  GCP_PROJECT_ID_PROD,
  BRAND_ASSETS,
} from './index.ts';

test('parseNodeEnv defaults to development', () => {
  assert.equal(parseNodeEnv(undefined), 'development');
});

test('parseNodeEnv accepts production', () => {
  assert.equal(parseNodeEnv('production'), 'production');
});

test('packageNameSchema accepts scoped package names', () => {
  assert.equal(packageNameSchema.parse('@repo/config'), '@repo/config');
});

test('identity constants keep product name separate from code prefixes', () => {
  assert.equal(PRODUCT_NAME, 'BlackStory');
  assert.equal(PACKAGE_SCOPE, '@repo');
  assert.equal(GCP_PROJECT_ID_PROD, 'black-book-efaaf');
  assert.equal(BRAND_ASSETS.lockup.dark, '/brand/lockup-dark.png');
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
