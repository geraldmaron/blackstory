/**
 * Unit tests for the Firestore ReleaseStore adapter using an injectable in-memory
 * transaction backend (no live emulator required).
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
import type { AtomicTransaction } from './audit-outbox.js';
import {
  MOBILE_RELEASE_POINTER_PATH,
  createFirestoreReleaseStore,
  type ReleaseStoreBackend,
} from './release-store.js';

type Operation =
  | {
      readonly kind: 'create' | 'set';
      readonly path: string;
      readonly data: Readonly<Record<string, unknown>>;
    }
  | { readonly kind: 'update'; readonly path: string; readonly data: Readonly<Record<string, unknown>> }
  | { readonly kind: 'delete'; readonly path: string };

class MemoryReleaseStoreBackend implements ReleaseStoreBackend {
  private documents = new Map<string, Readonly<Record<string, unknown>>>();

  seed(path: string, data: Readonly<Record<string, unknown>>): void {
    this.documents.set(path, structuredClone(data));
  }

  read(path: string): Promise<Readonly<Record<string, unknown>> | undefined> {
    const value = this.documents.get(path);
    return Promise.resolve(value ? structuredClone(value) : undefined);
  }

  delete(path: string): Promise<void> {
    this.documents.delete(path);
    return Promise.resolve();
  }

  listIds(collectionPath: string): Promise<readonly string[]> {
    const prefix = `${collectionPath}/`;
    const ids = [...this.documents.keys()]
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length));
    return Promise.resolve(ids);
  }

  async runTransaction<T>(operation: (transaction: AtomicTransaction) => Promise<T>): Promise<T> {
    const operations: Operation[] = [];
    const transaction: AtomicTransaction = {
      get: async (path) => {
        const value = this.documents.get(path);
        return {
          exists: value !== undefined,
          data: () => (value ? structuredClone(value) : undefined),
        };
      },
      create: (path, data) =>
        operations.push({ kind: 'create', path, data: structuredClone(data) }),
      set: (path, data) => operations.push({ kind: 'set', path, data: structuredClone(data) }),
      update: (path, data) =>
        operations.push({ kind: 'update', path, data: structuredClone(data) }),
      delete: (path) => operations.push({ kind: 'delete', path }),
    };

    const result = await operation(transaction);
    const next = new Map(this.documents);
    for (const staged of operations) {
      if (staged.kind === 'delete') {
        next.delete(staged.path);
        continue;
      }
      if (staged.kind === 'create' && next.has(staged.path)) {
        throw new Error(`Document already exists: ${staged.path}`);
      }
      if (staged.kind === 'update') {
        const existing = next.get(staged.path);
        if (!existing) {
          throw new Error(`Document does not exist: ${staged.path}`);
        }
        next.set(staged.path, { ...existing, ...staged.data });
      } else {
        next.set(staged.path, staged.data);
      }
    }
    this.documents = next;
    return result;
  }
}

const ARTIFACT_PATH = 'public/releases/rel_a/bootstrap.json';

function artifact(canonical = '{"schemaVersion":1}'): GeneratedArtifact {
  return sealArtifact('bootstrap', ARTIFACT_PATH, JSON.parse(canonical));
}

function storedRelease(releaseId: string, artifactPaths: readonly string[] = [ARTIFACT_PATH]): StoredRelease {
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
  const backend = new MemoryReleaseStoreBackend();
  const store = createFirestoreReleaseStore(backend);
  const first = artifact();

  await store.putArtifact(first);
  await store.putArtifact(first);

  const stored = await store.getArtifact(ARTIFACT_PATH);
  assert.equal(stored?.hash.digest, first.hash.digest);
  assert.equal(stored?.canonical, first.canonical);
});

test('putArtifact refuses different-content overwrite', async () => {
  const backend = new MemoryReleaseStoreBackend();
  const store = createFirestoreReleaseStore(backend);
  await store.putArtifact(artifact());

  await assert.rejects(
    store.putArtifact(artifact('{"schemaVersion":2}')),
    (error: unknown) =>
      error instanceof ReleaseActivationError && error.code === 'IMMUTABLE_ARTIFACT_VIOLATION',
  );
});

test('flipPointer commits only when pointerVersion matches expectedVersion', async () => {
  const backend = new MemoryReleaseStoreBackend();
  const store = createFirestoreReleaseStore(backend);

  await store.flipPointer(pointer('rel_a', 1), 0);
  assert.deepEqual(await store.getPointer(), pointer('rel_a', 1));

  await assert.rejects(
    store.flipPointer(pointer('rel_b', 2), 0),
    (error: unknown) =>
      error instanceof ReleaseActivationError && error.code === 'CONCURRENT_ACTIVATION',
  );
  assert.deepEqual(await store.getPointer(), pointer('rel_a', 1));
});

test('flipPointer updates an existing pointer document via compare-and-set', async () => {
  const backend = new MemoryReleaseStoreBackend();
  backend.seed(MOBILE_RELEASE_POINTER_PATH, {
    activeReleaseId: 'rel_a',
    releaseStamp: 'rel_a-stamp',
    bootstrapPath: 'public/releases/rel_a/bootstrap.json',
    activatedAt: '2026-07-19T00:00:00.000Z',
    pointerVersion: 1,
  });
  const store = createFirestoreReleaseStore(backend);

  await store.flipPointer(pointer('rel_b', 2, 'rel_a'), 1);
  assert.deepEqual(await store.getPointer(), pointer('rel_b', 2, 'rel_a'));
});

test('deleteRelease refuses active and rollback-target releases', async () => {
  const backend = new MemoryReleaseStoreBackend();
  const store = createFirestoreReleaseStore(backend);
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
  const backend = new MemoryReleaseStoreBackend();
  const store = createFirestoreReleaseStore(backend);
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
