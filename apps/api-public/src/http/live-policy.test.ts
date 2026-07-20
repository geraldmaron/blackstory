/**
 * `shouldUsePublicFirestoreDataAccess` gate tests — pure env-in/bool-out, no Firestore touched.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldUsePublicFirestoreDataAccess } from './live-policy.js';

const PRODUCTION_LOCAL = {
  FIREBASE_PROJECT_ID: 'black-book-efaaf',
  BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION: '1',
};

test('defaults to false with no env at all', () => {
  assert.equal(shouldUsePublicFirestoreDataAccess({}), false);
});

test('false when explicitly disabled even with production project + break-glass', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({ ...PRODUCTION_LOCAL, PUBLIC_READ_API_DISABLED: '1' }),
    false,
  );
});

test('false when caller forces fixtures/seed source', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({ ...PRODUCTION_LOCAL, PUBLIC_DATA_SOURCE: 'fixtures' }),
    false,
  );
  assert.equal(
    shouldUsePublicFirestoreDataAccess({ ...PRODUCTION_LOCAL, PUBLIC_DATA_SOURCE: 'seed' }),
    false,
  );
});

test('false when emulator signals are present, even with production project id', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({
      ...PRODUCTION_LOCAL,
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    }),
    false,
  );
});

test('false for a non-production project id without an explicit firestore override', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({
      FIREBASE_PROJECT_ID: 'some-other-project',
      BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION: '1',
    }),
    false,
  );
});

test('true for a non-production project id with an explicit PUBLIC_DATA_SOURCE=firestore override', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({
      FIREBASE_PROJECT_ID: 'some-other-project',
      BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION: '1',
      PUBLIC_DATA_SOURCE: 'firestore',
    }),
    true,
  );
});

test('false for production project id in a non-production NODE_ENV without break-glass', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({
      FIREBASE_PROJECT_ID: 'black-book-efaaf',
      NODE_ENV: 'development',
    }),
    false,
  );
});

test('true for production project id + local dev + break-glass flag (documented local run command)', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({ ...PRODUCTION_LOCAL, NODE_ENV: 'development' }),
    true,
  );
});

test('true for production project id + NODE_ENV=production, no break-glass needed', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({
      FIREBASE_PROJECT_ID: 'black-book-efaaf',
      NODE_ENV: 'production',
    }),
    true,
  );
});

test('resolves project id from GOOGLE_CLOUD_PROJECT when FIREBASE_PROJECT_ID is unset', () => {
  assert.equal(
    shouldUsePublicFirestoreDataAccess({
      GOOGLE_CLOUD_PROJECT: 'black-book-efaaf',
      NODE_ENV: 'production',
    }),
    true,
  );
});
