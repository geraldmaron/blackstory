/**
 * Security-layer tests: production access must fail closed.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertTestsCannotAccessProduction,
  collectProductionGuardFindings,
  isLocalDatabaseUrl,
  looksLikeProductionProjectId,
} from './production.ts';

test('local database URLs are accepted', () => {
  assert.equal(
    isLocalDatabaseUrl('postgresql://blackbook:blackbook@127.0.0.1:5432/blackbook'),
    true,
  );
  assert.equal(isLocalDatabaseUrl('postgres://blackbook@localhost/blackbook'), true);
});

test('cloud database URLs are rejected', () => {
  assert.equal(
    isLocalDatabaseUrl('postgresql://user:pass@1.2.3.4:5432/db?host=/cloudsql/proj:region:inst'),
    false,
  );
  assert.equal(
    isLocalDatabaseUrl('postgresql://user:pass@db.example.supabase.co:5432/postgres'),
    false,
  );
});

test('production project ids are detected', () => {
  assert.equal(looksLikeProductionProjectId('demo-black-book'), false);
  assert.equal(looksLikeProductionProjectId('black-book-efaaf'), true);
  assert.equal(looksLikeProductionProjectId('black-book-prod'), true);
  assert.equal(looksLikeProductionProjectId('my-production-app'), true);
});

test('assertTestsCannotAccessProduction fails closed on production signals', () => {
  const findings = collectProductionGuardFindings({
    NODE_ENV: 'test',
    FIREBASE_PROJECT_ID: 'black-book-prod',
    DATABASE_URL: 'postgresql://user:pass@db.example.supabase.co:5432/postgres',
  });
  assert.ok(findings.length >= 2);
  assert.throws(
    () =>
      assertTestsCannotAccessProduction({
        FIREBASE_PROJECT_ID: 'black-book-efaaf',
      }),
    /production services/,
  );
});

test('local demo environment passes the production guard', () => {
  assert.doesNotThrow(() =>
    assertTestsCannotAccessProduction({
      NODE_ENV: 'test',
      FIREBASE_PROJECT_ID: 'demo-black-book',
      DATABASE_URL: 'postgresql://blackbook:blackbook@127.0.0.1:5432/blackbook',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    }),
  );
});
