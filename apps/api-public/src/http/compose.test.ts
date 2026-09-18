/** Production composition selects Postgres explicitly and injects API controls. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProductionHandlerDeps } from './compose.js';

test('createProductionHandlerDeps uses empty in-memory data when live gate is false', async () => {
  const deps = createProductionHandlerDeps({ environment: {} });
  assert.equal(await deps.dataAccess.getReleasePointer(), undefined);
  assert.equal(await deps.dataAccess.getEntity('rel_any', 'ent_any'), undefined);
});

test('createProductionHandlerDeps wires real guards regardless of data source', () => {
  const deps = createProductionHandlerDeps({ environment: {} });
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

test('createProductionHandlerDeps selects Postgres adapter when PUBLIC_DATA_SOURCE=postgres', () => {
  const deps = createProductionHandlerDeps({
    environment: {
      PUBLIC_DATA_SOURCE: 'postgres',
      DATABASE_URL: 'postgresql://example.invalid/blackstory',
      NODE_ENV: 'production',
    },
  });
  assert.equal(typeof deps.dataAccess.getReleasePointer, 'function');
  assert.equal(typeof deps.dataAccess.search, 'function');
});

test('createProductionHandlerDeps does not silently select a data source when PUBLIC_DATA_SOURCE unset', async () => {
  const deps = createProductionHandlerDeps({
    environment: {
      NODE_ENV: 'production',
    },
  });
  assert.equal(await deps.dataAccess.getReleasePointer(), undefined);
});
