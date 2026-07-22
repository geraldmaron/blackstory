/**
 * Postgres release-activation drill tests (MOB-005 evidence gate).
 *
 * Exercises generateReleaseArtifacts → activateReleaseAsync → rollbackToAsync → collectGarbageAsync
 * against the injectable in-memory Postgres store backend — no live GCP/Supabase required.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactLocationForPublic } from '@repo/security';
import {
  ReleaseActivationError,
  generateReleaseArtifacts,
  type GenerateReleaseArtifactsInput,
} from '@repo/domain';
import {
  DECEASED_RESIDENCE_FIXTURE,
  INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE,
  PLACE_HARLEM_NY_FIXTURE,
} from '@repo/domain/map/fixtures';
import { MemoryPostgresReleaseStoreBackend } from './release-store.memory-backend.js';
import { createPostgresReleaseStore } from './release-store.js';
import {
  activateReleaseAsync,
  collectGarbageAsync,
  rollbackToAsync,
} from './release-activation.js';

const BOOTSTRAP = {
  schemaRange: { min: 1, max: 1 },
  compatibility: {
    apiVersion: 'v1',
    minSupportedApiVersion: 'v1',
    deprecationWindowDays: 90,
    minSupportedAppBuild: 1000,
  },
  featureFlags: { search: true, map: true },
  legalVersions: { privacyPolicy: '2026-07-01', termsOfService: '2026-07-01' },
  cacheDirectives: {
    bootstrapMaxAgeSeconds: 60,
    bootstrapStaleWhileRevalidateSeconds: 600,
    releaseArtifactImmutableMaxAgeSeconds: 31_536_000,
  },
} as const;

function input(
  releaseId: string,
  overrides: Partial<GenerateReleaseArtifactsInput> = {},
): GenerateReleaseArtifactsInput {
  return {
    releaseId,
    generatedAt: '2026-07-21T12:00:00.000Z',
    mapEntities: [PLACE_HARLEM_NY_FIXTURE, INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE, DECEASED_RESIDENCE_FIXTURE],
    redactLocation: redactLocationForPublic,
    contentIndex: [{ id: 'story-1', kind: 'story', title: 'A Story', version: 'v1' }],
    entitiesList: { schemaVersion: 1, entities: [{ id: 'ent_a', displayName: 'A' }] },
    searchIndex: { schemaVersion: 1, docs: [{ id: 'ent_a', nameLower: 'a' }] },
    bootstrap: BOOTSTRAP,
    ...overrides,
  };
}

test('Postgres activation drill: activate A → activate B → rollback to A → GC retains active+previous', async () => {
  const store = createPostgresReleaseStore(new MemoryPostgresReleaseStoreBackend());
  const relA = generateReleaseArtifacts(input('rel_mob005_a'));
  const relB = generateReleaseArtifacts(input('rel_mob005_b'));

  const first = await activateReleaseAsync(store, relA);
  assert.equal(first.pointer.activeReleaseId, 'rel_mob005_a');
  assert.equal(first.pointer.pointerVersion, 1);

  const second = await activateReleaseAsync(store, relB);
  assert.equal(second.pointer.activeReleaseId, 'rel_mob005_b');
  assert.equal(second.pointer.previousReleaseId, 'rel_mob005_a');

  const rolled = await rollbackToAsync(store, 'rel_mob005_a');
  assert.equal(rolled.pointer.activeReleaseId, 'rel_mob005_a');
  assert.equal(rolled.releaseStamp, relA.manifest.releaseStamp);

  await activateReleaseAsync(store, generateReleaseArtifacts(input('rel_mob005_c')));
  const gc = await collectGarbageAsync(store);
  assert.deepEqual([...gc.deleted], ['rel_mob005_b']);
  assert.ok(gc.retained.includes('rel_mob005_c'));
  assert.ok(gc.retained.includes('rel_mob005_a'));
});

test('Postgres activation rejects corrupted artifact before pointer moves', async () => {
  const store = createPostgresReleaseStore(new MemoryPostgresReleaseStoreBackend());
  await activateReleaseAsync(store, generateReleaseArtifacts(input('rel_good')));

  const bad = generateReleaseArtifacts(input('rel_bad'));
  const tampered = {
    ...bad,
    artifacts: bad.artifacts.map((artifact, index) =>
      index === 0 ? { ...artifact, json: { tampered: true } } : artifact,
    ),
  };

  await assert.rejects(
    activateReleaseAsync(store, tampered),
    (error: unknown) => error instanceof ReleaseActivationError && error.code === 'RELEASE_VALIDATION',
  );
  assert.equal((await store.getPointer())?.activeReleaseId, 'rel_good');
});

test('syncPublicationPointer hook fires on pointer flip when configured', async () => {
  const syncCalls: string[] = [];
  const backend = new MemoryPostgresReleaseStoreBackend();
  const store = createPostgresReleaseStore(backend, {
    async syncPublicationPointer(pointer) {
      syncCalls.push(pointer.activeReleaseId);
    },
  });
  await activateReleaseAsync(store, generateReleaseArtifacts(input('rel_sync')));
  assert.deepEqual(syncCalls, ['rel_sync']);
});
