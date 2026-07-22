/**
 * Unit tests for the Postgres ReleaseStore adapter using an injectable in-memory
 * transaction backend (no live Supabase required).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ReleaseActivationError,
  sealArtifact,
  type ActiveReleasePointer,
  type GeneratedArtifact,
  type StoredRelease,
} from '@repo/domain';
import { POSTGRES_MOBILE_RELEASE_POINTER_KEY, createPostgresReleaseStore } from './release-store.js';
import { MemoryPostgresReleaseStoreBackend } from './release-store.memory-backend.js';

const ARTIFACT_PATH = 'public/releases/rel_a/bootstrap.json';

function artifact(canonical = '{"schemaVersion":1}'): GeneratedArtifact {
  return sealArtifact('bootstrap', ARTIFACT_PATH, JSON.parse(canonical));
}

function storedRelease(
  releaseId: string,
  artifactPaths: readonly string[] = [ARTIFACT_PATH],
): StoredRelease {
  return {
    releaseId,
    manifest: {
      schemaVersion: 1,
      releaseStamp: `${releaseId}-stamp`,
      activeRelease: {
        releaseId,
        generatedAt: '2026-07-19T00:00:00.000Z',
        recordUpdatedAt: '2026-07-19T00:00:00.000Z',
      },
      schemaRange: { min: 1, max: 1 },
      artifactHashes: {
        bootstrap: {
          path: ARTIFACT_PATH,
          hash: { algorithm: 'sha256', digest: 'a'.repeat(64) },
          byteLength: 18,
        },
      },
      compatibility: {
        apiVersion: 'v1',
        minSupportedApiVersion: 'v1',
        deprecationWindowDays: 90,
        minSupportedAppBuild: 1000,
      },
      featureFlags: { search: true },
      legalVersions: { privacyPolicy: '2026-07-01', termsOfService: '2026-07-01' },
      degradedMode: false,
      cacheDirectives: {
        bootstrapMaxAgeSeconds: 60,
        bootstrapStaleWhileRevalidateSeconds: 600,
        releaseArtifactImmutableMaxAgeSeconds: 31_536_000,
      },
    },
    artifactPaths,
  };
}

function pointer(
  activeReleaseId: string,
  pointerVersion: number,
  previousReleaseId?: string,
): ActiveReleasePointer {
  return {
    activeReleaseId,
    ...(previousReleaseId !== undefined ? { previousReleaseId } : {}),
    releaseStamp: `${activeReleaseId}-stamp`,
    bootstrapPath: `public/releases/${activeReleaseId}/bootstrap.json`,
    activatedAt: '2026-07-19T00:00:00.000Z',
    pointerVersion,
  };
}

test('putArtifact writes content-addressed artifacts and allows byte-identical rewrite', async () => {
  const backend = new MemoryPostgresReleaseStoreBackend();
  const store = createPostgresReleaseStore(backend);
  const first = artifact();

  await store.putArtifact(first);
  await store.putArtifact(first);

  const stored = await store.getArtifact(ARTIFACT_PATH);
  assert.equal(stored?.hash.digest, first.hash.digest);
  assert.equal(stored?.canonical, first.canonical);
});

test('putArtifact refuses different-content overwrite', async () => {
  const backend = new MemoryPostgresReleaseStoreBackend();
  const store = createPostgresReleaseStore(backend);
  await store.putArtifact(artifact());

  await assert.rejects(
    store.putArtifact(artifact('{"schemaVersion":2}')),
    (error: unknown) =>
      error instanceof ReleaseActivationError && error.code === 'IMMUTABLE_ARTIFACT_VIOLATION',
  );
});

test('flipPointer commits only when pointerVersion matches expectedVersion', async () => {
  const backend = new MemoryPostgresReleaseStoreBackend();
  const store = createPostgresReleaseStore(backend);
  await store.putRelease(storedRelease('rel_a'));

  await store.flipPointer(pointer('rel_a', 1), 0);
  assert.deepEqual(await store.getPointer(), pointer('rel_a', 1));

  await assert.rejects(
    store.flipPointer(pointer('rel_b', 2), 0),
    (error: unknown) =>
      error instanceof ReleaseActivationError && error.code === 'CONCURRENT_ACTIVATION',
  );
  assert.deepEqual(await store.getPointer(), pointer('rel_a', 1));
});

test('flipPointer updates an existing pointer row via compare-and-set', async () => {
  const backend = new MemoryPostgresReleaseStoreBackend();
  backend.seed(POSTGRES_MOBILE_RELEASE_POINTER_KEY, {
    activeReleaseId: 'rel_a',
    releaseStamp: 'rel_a-stamp',
    bootstrapPath: 'public/releases/rel_a/bootstrap.json',
    activatedAt: '2026-07-19T00:00:00.000Z',
    pointerVersion: 1,
  });
  const store = createPostgresReleaseStore(backend);
  await store.putRelease(storedRelease('rel_b'));

  await store.flipPointer(pointer('rel_b', 2, 'rel_a'), 1);
  assert.deepEqual(await store.getPointer(), pointer('rel_b', 2, 'rel_a'));
});

test('deleteRelease refuses active and rollback-target releases', async () => {
  const backend = new MemoryPostgresReleaseStoreBackend();
  const store = createPostgresReleaseStore(backend);
  await store.putRelease(storedRelease('rel_a'));
  await store.putRelease(storedRelease('rel_b'));
  await store.flipPointer(pointer('rel_b', 1, 'rel_a'), 0);

  await assert.rejects(
    store.deleteRelease('rel_b'),
    (error: unknown) =>
      error instanceof ReleaseActivationError && error.code === 'PROTECTED_RELEASE',
  );
  await assert.rejects(
    store.deleteRelease('rel_a'),
    (error: unknown) =>
      error instanceof ReleaseActivationError && error.code === 'PROTECTED_RELEASE',
  );
});

test('deleteRelease removes an unprotected release and its artifacts', async () => {
  const backend = new MemoryPostgresReleaseStoreBackend();
  const store = createPostgresReleaseStore(backend);
  const bootstrap = artifact('{"schemaVersion":9}');
  await store.putArtifact(bootstrap);
  await store.putRelease(storedRelease('rel_old', [bootstrap.path]));
  await store.putRelease(storedRelease('rel_active'));
  await store.flipPointer(pointer('rel_active', 1), 0);

  await store.deleteRelease('rel_old');

  assert.equal(await store.getRelease('rel_old'), undefined);
  assert.equal(await store.getArtifact(bootstrap.path), undefined);
  assert.deepEqual(await store.listReleaseIds(), ['rel_active']);
});
