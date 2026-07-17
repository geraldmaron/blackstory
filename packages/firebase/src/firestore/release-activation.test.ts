
/**
 * In-memory transaction tests for atomic activation, rollback, idempotency,
 * immutable manifests, and active-release public-read guards.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AtomicStore, AtomicTransaction } from './audit-outbox.js';
import {
  activatePublicationRelease,
  resolveActivePublicRelease,
  type ImmutablePublicationReleaseDoc,
} from './release-activation.js';
import type { AuditEventDoc, OutboxMessageDoc } from './types.js';

type Operation =
  | {
      readonly kind: 'create' | 'set';
      readonly path: string;
      readonly data: Record<string, unknown>;
    }
  | { readonly kind: 'update'; readonly path: string; readonly data: Record<string, unknown> };

class MemoryAtomicStore implements AtomicStore {
  private documents = new Map<string, Readonly<Record<string, unknown>>>();

  seed(path: string, data: Readonly<Record<string, unknown>>): void {
    this.documents.set(path, structuredClone(data));
  }

  read(path: string): Readonly<Record<string, unknown>> | undefined {
    const value = this.documents.get(path);
    return value ? structuredClone(value) : undefined;
  }

  paths(): readonly string[] {
    return [...this.documents.keys()].sort();
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
    };

    const result = await operation(transaction);
    const next = new Map(this.documents);
    for (const staged of operations) {
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

const NOW = '2026-07-17T04:00:00.000Z';
const DIGEST = 'a'.repeat(64);

function release(
  id: string,
  status: ImmutablePublicationReleaseDoc['status'],
  searchIndexVersion = `search-${id}`,
): ImmutablePublicationReleaseDoc {
  return {
    id,
    status,
    searchIndexVersion,
    signedManifest: {
      manifest: { releaseId: id, searchIndexVersion },
      manifestHash: { algorithm: 'sha256', digest: DIGEST },
      signature: {
        algorithm: 'ecdsa-sha256',
        keyId: 'publication-key-1',
        value: 'base64-signature',
      },
    },
    createdAt: NOW,
    createdBy: 'publisher-1',
    ...(status === 'active' ? { activatedAt: NOW } : {}),
  };
}

function auditEvent(targetReleaseId: string, suffix = targetReleaseId): AuditEventDoc {
  return {
    id: `audit-${suffix}`,
    action: 'publication.release_activated',
    category: 'publication',
    actor: { id: 'publisher-1', type: 'user' },
    subject: {
      type: 'publicationRelease',
      id: targetReleaseId,
      path: `publicationReleases/${targetReleaseId}`,
    },
    reason: 'Approved release activation',
    requestId: `request-${suffix}`,
    releaseId: targetReleaseId,
    correlationId: `correlation-${suffix}`,
    idempotencyKey: `activate:${suffix}`,
    occurredAt: NOW,
  };
}

function outboxMessage(
  targetReleaseId: string,
  searchIndexVersion: string,
  suffix = targetReleaseId,
): OutboxMessageDoc {
  return {
    id: `outbox-${suffix}`,
    eventId: `audit-${suffix}`,
    topic: 'publication.release_activated',
    aggregateType: 'publicationRelease',
    aggregateId: targetReleaseId,
    payload: { releaseId: targetReleaseId, searchIndexVersion },
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    availableAt: NOW,
    createdAt: NOW,
    correlationId: `correlation-${suffix}`,
    idempotencyKey: `activate:${suffix}`,
  };
}

function input(targetReleaseId: string, mode: 'activate' | 'rollback' = 'activate') {
  const searchIndexVersion = `search-${targetReleaseId}`;
  return {
    targetReleaseId,
    mode,
    now: NOW,
    auditEvent: auditEvent(targetReleaseId),
    outboxMessage: outboxMessage(targetReleaseId, searchIndexVersion),
    verifySignedManifest: () => true,
  };
}

test('activation atomically flips pointer, statuses, audit, outbox, and marker', async () => {
  const store = new MemoryAtomicStore();
  store.seed('publicationReleases/release-old', release('release-old', 'active'));
  store.seed('publicationReleases/release-new', release('release-new', 'preview'));
  store.seed('publicMeta/activeRelease', {
    releaseId: 'release-old',
    activatedAt: NOW,
    searchIndexVersion: 'search-release-old',
    manifestHash: DIGEST,
  });
  const originalManifest = store.read('publicationReleases/release-new')?.signedManifest;

  const result = await activatePublicationRelease(store, input('release-new'));

  assert.equal(result.committed, true);
  assert.equal(result.previousReleaseId, 'release-old');
  assert.equal(store.read('publicMeta/activeRelease')?.releaseId, 'release-new');
  assert.equal(store.read('publicationReleases/release-new')?.status, 'active');
  assert.equal(store.read('publicationReleases/release-old')?.status, 'superseded');
  assert.deepEqual(store.read('publicationReleases/release-new')?.signedManifest, originalManifest);
  assert.ok(store.read('auditEvents/audit-release-new'));
  assert.ok(store.read('outboxMessages/outbox-release-new'));
  assert.ok(store.paths().some((path) => path.startsWith('idempotencyKeys/')));
});

test('draft release cannot activate and leaves all documents unchanged', async () => {
  const store = new MemoryAtomicStore();
  store.seed('publicationReleases/release-draft', release('release-draft', 'draft'));
  const before = store.paths();

  await assert.rejects(
    activatePublicationRelease(store, input('release-draft')),
    /status draft cannot activate/,
  );

  assert.deepEqual(store.paths(), before);
  assert.equal(store.read('publicMeta/activeRelease'), undefined);
  assert.equal(store.read('publicationReleases/release-draft')?.status, 'draft');
});

test('invalid manifest signature fails closed before activation writes', async () => {
  const store = new MemoryAtomicStore();
  store.seed('publicationReleases/release-new', release('release-new', 'preview'));

  await assert.rejects(
    activatePublicationRelease(store, {
      ...input('release-new'),
      verifySignedManifest: () => false,
    }),
    /manifest signature is invalid/,
  );

  assert.equal(store.read('publicationReleases/release-new')?.status, 'preview');
  assert.equal(store.read('publicMeta/activeRelease'), undefined);
  assert.equal(store.read('auditEvents/audit-release-new'), undefined);
});

test('rollback activates a historical release without rebuilding artifacts', async () => {
  const store = new MemoryAtomicStore();
  store.seed('publicationReleases/release-current', release('release-current', 'active'));
  store.seed('publicationReleases/release-prior', release('release-prior', 'superseded'));
  store.seed('publicMeta/activeRelease', {
    releaseId: 'release-current',
    activatedAt: NOW,
    searchIndexVersion: 'search-release-current',
    manifestHash: DIGEST,
  });
  store.seed('publicReleases/release-prior/entities/entity-1', {
    id: 'entity-1',
    releaseId: 'release-prior',
  });
  const historicalProjection = store.read('publicReleases/release-prior/entities/entity-1');

  const result = await activatePublicationRelease(store, input('release-prior', 'rollback'));

  assert.equal(result.releaseId, 'release-prior');
  assert.equal(store.read('publicationReleases/release-prior')?.status, 'active');
  assert.equal(store.read('publicationReleases/release-current')?.status, 'rolled_back');
  assert.deepEqual(
    store.read('publicReleases/release-prior/entities/entity-1'),
    historicalProjection,
  );
});

test('a late audit conflict aborts the pointer and lifecycle updates', async () => {
  const store = new MemoryAtomicStore();
  store.seed('publicationReleases/release-old', release('release-old', 'active'));
  store.seed('publicationReleases/release-new', release('release-new', 'preview'));
  store.seed('publicMeta/activeRelease', {
    releaseId: 'release-old',
    activatedAt: NOW,
    searchIndexVersion: 'search-release-old',
    manifestHash: DIGEST,
  });
  store.seed('auditEvents/audit-release-new', { existing: true });

  await assert.rejects(activatePublicationRelease(store, input('release-new')), /already exists/);

  assert.equal(store.read('publicMeta/activeRelease')?.releaseId, 'release-old');
  assert.equal(store.read('publicationReleases/release-new')?.status, 'preview');
  assert.equal(store.read('publicationReleases/release-old')?.status, 'active');
  assert.equal(store.read('outboxMessages/outbox-release-new'), undefined);
});

test('idempotency replay performs no duplicate activation effects', async () => {
  const store = new MemoryAtomicStore();
  store.seed('publicationReleases/release-new', release('release-new', 'preview'));

  const first = await activatePublicationRelease(store, input('release-new'));
  const replay = await activatePublicationRelease(store, input('release-new'));

  assert.equal(first.committed, true);
  assert.equal(replay.replayed, true);
  assert.equal(store.paths().filter((path) => path === 'auditEvents/audit-release-new').length, 1);
});

test('public resolver refuses preview and mismatched immutable releases', () => {
  const pointer = {
    releaseId: 'release-a',
    activatedAt: NOW,
    searchIndexVersion: 'search-release-a',
    manifestHash: DIGEST,
  };
  assert.throws(
    () => resolveActivePublicRelease(pointer, release('release-a', 'preview')),
    /does not match an active/,
  );
  assert.throws(
    () => resolveActivePublicRelease(pointer, release('release-b', 'active')),
    /does not match an active/,
  );
  assert.equal(resolveActivePublicRelease(pointer, release('release-a', 'active')).id, 'release-a');
});
