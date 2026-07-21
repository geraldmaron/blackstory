/**
 * Unit tests for public entity resolve fallback policy under seed vs postgres SoR.
 */

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { resolvePublicEntity } from './degraded-mode.ts';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

test('resolvePublicEntity returns live data when liveFetch succeeds', async () => {
  process.env.PUBLIC_DATA_SOURCE = 'postgres';
  delete process.env.PUBLIC_READ_API_DISABLED;

  const result = await resolvePublicEntity('ent_live_001', async () => ({
    id: 'ent_live_001',
  }) as never);

  assert.equal(result.source, 'live');
  assert.equal(result.data?.id, 'ent_live_001');
});

test('resolvePublicEntity refuses seed fallback under PUBLIC_DATA_SOURCE=postgres on miss', async () => {
  process.env.PUBLIC_DATA_SOURCE = 'postgres';
  delete process.env.PUBLIC_READ_API_DISABLED;

  const result = await resolvePublicEntity('ent_15th_st_church_001', async () => undefined);

  assert.equal(result.source, 'none');
  assert.equal(result.data, undefined);
});

test('resolvePublicEntity refuses seed fallback under postgres when liveFetch throws', async () => {
  process.env.PUBLIC_DATA_SOURCE = 'postgres';
  delete process.env.PUBLIC_READ_API_DISABLED;

  const result = await resolvePublicEntity('ent_15th_st_church_001', async () => {
    throw new Error('connection refused');
  });

  assert.equal(result.source, 'none');
  assert.equal(result.data, undefined);
});

test('resolvePublicEntity may use seed snapshot when not in postgres SoR mode', async () => {
  process.env.PUBLIC_DATA_SOURCE = 'seed';
  delete process.env.PUBLIC_READ_API_DISABLED;

  const result = await resolvePublicEntity('ent_15th_st_church_001', async () => undefined);

  assert.equal(result.source, 'snapshot');
  assert.equal(result.data?.id, 'ent_15th_st_church_001');
  assert.equal(result.data?.revision.releaseId, 'seed-snapshot');
});
