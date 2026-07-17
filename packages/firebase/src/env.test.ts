
/**
 * Unit tests for Firebase env validation and production/emulator guards.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEMO_PROJECT_ID,
  PRODUCTION_BREAK_GLASS_ENV,
  PRODUCTION_PROJECT_ID,
  WEB_APP_ID,
  assertFirebaseProjectAllowed,
  parseAdminFirebaseEnv,
  parseServerFirebaseEnv,
  parseWebFirebaseEnv,
} from './index.ts';

const emulatorEnv = {
  NODE_ENV: 'development',
  FIREBASE_EMULATOR_MODE: '1',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
} as const;

test('parseWebFirebaseEnv defaults to demo project in emulator mode', () => {
  const parsed = parseWebFirebaseEnv(emulatorEnv);
  assert.equal(parsed.mode, 'emulator');
  assert.equal(parsed.config.projectId, DEMO_PROJECT_ID);
  assert.equal(parsed.config.appId, WEB_APP_ID);
});

test('parseAdminFirebaseEnv uses distinct admin app id defaults in emulator mode', () => {
  const parsed = parseAdminFirebaseEnv(emulatorEnv);
  assert.equal(parsed.mode, 'emulator');
  assert.equal(parsed.config.projectId, DEMO_PROJECT_ID);
  assert.match(parsed.config.appId, /e1b31c78e32d95943bfd78$/);
});

test('parseServerFirebaseEnv does not require credentials for emulator mode', () => {
  const parsed = parseServerFirebaseEnv(emulatorEnv);
  assert.equal(parsed.mode, 'emulator');
  assert.equal(parsed.projectId, DEMO_PROJECT_ID);
  assert.equal(parsed.credentials, undefined);
});

test('local runtime without emulators refuses production project', () => {
  assert.throws(
    () =>
      parseWebFirebaseEnv({
        NODE_ENV: 'development',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: PRODUCTION_PROJECT_ID,
      }),
    /emulator-only/,
  );
});

test('emulator mode refuses production project id', () => {
  assert.throws(
    () =>
      assertFirebaseProjectAllowed(PRODUCTION_PROJECT_ID, {
        ...emulatorEnv,
      }),
    /Refusing production project/,
  );
});

test('production mode accepts registered project with break-glass outside NODE_ENV=production', () => {
  const mode = assertFirebaseProjectAllowed(PRODUCTION_PROJECT_ID, {
    NODE_ENV: 'development',
    [PRODUCTION_BREAK_GLASS_ENV]: '1',
  });
  assert.equal(mode, 'production');
});

test('production NODE_ENV accepts production project without emulator signals', () => {
  const parsed = parseWebFirebaseEnv({
    NODE_ENV: 'production',
  });
  assert.equal(parsed.mode, 'production');
  assert.equal(parsed.config.projectId, PRODUCTION_PROJECT_ID);
});
