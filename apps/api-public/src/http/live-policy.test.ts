/**
 * `shouldUsePublicPostgresDataAccess` gate tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldUsePublicPostgresDataAccess } from './live-policy.js';

const POSTGRES_PRODUCTION = {
  PUBLIC_DATA_SOURCE: 'postgres',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/blackbook',
  NODE_ENV: 'production',
};

test('postgres: false with no env at all', () => {
  assert.equal(shouldUsePublicPostgresDataAccess({}), false);
});

test('postgres: false when caller forces fixtures/seed source', () => {
  assert.equal(
    shouldUsePublicPostgresDataAccess({ ...POSTGRES_PRODUCTION, PUBLIC_DATA_SOURCE: 'fixtures' }),
    false,
  );
  assert.equal(
    shouldUsePublicPostgresDataAccess({ ...POSTGRES_PRODUCTION, PUBLIC_DATA_SOURCE: 'seed' }),
    false,
  );
});

test('postgres: false when emulator signals are present', () => {
  assert.equal(
    shouldUsePublicPostgresDataAccess({
      ...POSTGRES_PRODUCTION,
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    }),
    false,
  );
});

test('postgres: false without DATABASE_URL even when source is postgres', () => {
  assert.equal(
    shouldUsePublicPostgresDataAccess({ PUBLIC_DATA_SOURCE: 'postgres', NODE_ENV: 'production' }),
    false,
  );
});

test('postgres: true for postgres source + DATABASE_URL in production', () => {
  assert.equal(shouldUsePublicPostgresDataAccess(POSTGRES_PRODUCTION), true);
});

test('postgres: true with APP_DATABASE_URL alias', () => {
  assert.equal(
    shouldUsePublicPostgresDataAccess({
      PUBLIC_DATA_SOURCE: 'postgres',
      APP_DATABASE_URL: 'postgresql://user:pass@localhost:5432/blackbook',
      NODE_ENV: 'production',
    }),
    true,
  );
});

test('postgres: false when PUBLIC_DATA_SOURCE unset even with DATABASE_URL (no silent default)', () => {
  assert.equal(
    shouldUsePublicPostgresDataAccess({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/blackbook',
      NODE_ENV: 'production',
    }),
    false,
  );
});
