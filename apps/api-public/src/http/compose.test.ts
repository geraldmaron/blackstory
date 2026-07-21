/**
 * Production composition tests — verifies `createProductionHandlerDeps` selects the safe adapter
 * and wires client attestation + rate/search guards without touching live Firebase (no ADC/emulator).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProductionHandlerDeps } from './compose.js';

/** Emulator-safe env so Firestore-backed reads can boot when the live gate is enabled. */
const EMULATOR_ENV = {
  FIREBASE_EMULATOR_MODE: '1',
  FIREBASE_PROJECT_ID: 'demo-black-book',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};

test('createProductionHandlerDeps uses empty in-memory data when live gate is false', async () => {
  const deps = createProductionHandlerDeps({ environment: EMULATOR_ENV });
  assert.equal(await deps.dataAccess.getReleasePointer(), undefined);
  assert.equal(await deps.dataAccess.getEntity('rel_any', 'ent_any'), undefined);
});

test('createProductionHandlerDeps wires real guards regardless of data source', () => {
  const deps = createProductionHandlerDeps({ environment: EMULATOR_ENV });
  assert.equal(typeof deps.clientAttestationGuard, 'function');
  assert.equal(typeof deps.rateLimitGuard.evaluate, 'function');
  assert.equal(typeof deps.searchGuard.evaluate, 'function');
});

test('createProductionHandlerDeps wires client attestation guard in monitor mode', async () => {
  const deps = createProductionHandlerDeps({ environment: { NODE_ENV: 'test' } });
  const missing = await deps.clientAttestationGuard({ headers: {} });
  const verified = await deps.clientAttestationGuard({
    headers: { 'x-blackstory-client': 'mobile/1.0.0; api=1' },
  });
  assert.equal(missing.allowed, true);
  assert.equal(missing.verified, false);
  assert.equal(verified.verified, true);
});
