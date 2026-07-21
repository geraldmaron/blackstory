/**
 * `shouldUsePublicPostgresDataAccess` / `shouldUsePublicFirestoreDataAccess` gate tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  shouldUsePublicFirestoreDataAccess,
  shouldUsePublicPostgresDataAccess,
} from './live-policy.js';

const PRODUCTION_LOCAL = {
  FIREBASE_PROJECT_ID: 'black-book-efaaf',
  APP_FIREBASE_ALLOW_PRODUCTION: '1',
};

const POSTGRES_PRODUCTION = {
  PUBLIC_DATA_SOURCE: 'postgres',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/blackbook',
  NODE_ENV: 'production',
};

test('postgres: false with no env at all', () => {
  assert.equal(shouldUsePublicPostgresDataAccess({}), false);
});

test('postgres: false when explicitly disabled', () => {
  assert.equal(
    shouldUsePublicPostgresDataAccess({ ...POSTGRES_PRODUCTION, PUBLIC_READ_API_DISABLED: '1' }),
    false,
  );
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

test('firestore: false with no env at all', () => {
  assert.equal(shouldUsePublicFirestoreDataAccess({}), false);
});

test('firestore: false for production project + NODE_ENV=production without explicit firestore source', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({
      FIREBASE_PROJECT_ID: 'black-book-efaaf',
      NODE_ENV: 'production',
    }),
    false,
  );
});

test('firestore: true for explicit firestore override + production project + break-glass local', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({
      ...PRODUCTION_LOCAL,
      PUBLIC_DATA_SOURCE: 'firestore',
      NODE_ENV: 'development',
    }),
    true,
  );
});

test('firestore: true for explicit firestore + NODE_ENV=production', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({
      PUBLIC_DATA_SOURCE: 'firestore',
      FIREBASE_PROJECT_ID: 'black-book-efaaf',
      NODE_ENV: 'production',
    }),
    true,
  );
});

test('firestore: false when postgres source is selected', () => {
  assert.equal(shouldUsePublicFirestoreDataAccess(POSTGRES_PRODUCTION), false);
});
