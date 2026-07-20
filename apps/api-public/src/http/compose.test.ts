/**
 * Production composition tests — verifies `createProductionHandlerDeps` selects the safe adapter
 * and wires App Check outage availability without touching live Firebase (no ADC/emulator).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_CHECK_OUTAGE_OVERRIDE_ENV } from './app-check-availability.js';
import { createProductionHandlerDeps } from './compose.js';

/** Emulator-safe env so `createPublicApiAppCheckGuard` can boot without production break-glass. */
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
  assert.equal(typeof deps.appCheckGuard, 'function');
  assert.equal(typeof deps.rateLimitGuard.evaluate, 'function');
  assert.equal(typeof deps.searchGuard.evaluate, 'function');
});

test('createProductionHandlerDeps samples APP_CHECK_OUTAGE_OVERRIDE via appCheckAvailability', () => {
  const environment: Record<string, string | undefined> = { ...EMULATOR_ENV };
  const deps = createProductionHandlerDeps({ environment });
  assert.equal(deps.appCheckAvailability?.(), 'available');
  environment[APP_CHECK_OUTAGE_OVERRIDE_ENV] = 'outage';
  assert.equal(deps.appCheckAvailability?.(), 'outage');
});
