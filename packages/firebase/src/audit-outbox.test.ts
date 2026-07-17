/**
 * In-memory transaction tests for BB-018 atomic commit, idempotent replay, retry, and dead letters.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  commitWithAudit,
  consumeOutboxMessage,
  type AtomicStore,
  type AtomicTransaction,
  type AuditEventDoc,
  type OutboxMessageDoc,
} from './firestore/index.js';

type Operation =
  | { kind: 'create' | 'set'; path: string; data: Readonly<Record<string, unknown>> }
  | { kind: 'update'; path: string; data: Readonly<Record<string, unknown>> };

class MemoryAtomicStore implements AtomicStore {
  private documents = new Map<string, Readonly<Record<string, unknown>>>();

  seed(path: string, data: Readonly<Record<string, unknown>>): void {
    this.documents.set(path, structuredClone(data));
  }

  read(path: string): Readonly<Record<string, unknown>> | undefined {
    const value = this.documents.get(path);
    return value ? structuredClone(value) : undefined;
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
      create: (path, data) => operations.push({ kind: 'create', path, data }),
      set: (path, data) => operations.push({ kind: 'set', path, data }),
      update: (path, data) => operations.push({ kind: 'update', path, data }),
    };

    const result = await operation(transaction);
    const next = new Map(this.documents);
    for (const staged of operations) {
      if (staged.kind === 'create' && next.has(staged.path)) {
        throw new Error(`Document already exists: ${staged.path}`);
      }
      if (staged.kind === 'update') {
        const existing = next.get(staged.path);
        if (!existing) throw new Error(`Document does not exist: ${staged.path}`);
        next.set(staged.path, { ...existing, ...structuredClone(staged.data) });
      } else {
        next.set(staged.path, structuredClone(staged.data));
      }
    }
    this.documents = next;
    return result;
  }
}

const NOW = '2026-07-16T20:00:00.000Z';

function auditEvent(overrides: Partial<AuditEventDoc> = {}): AuditEventDoc {
  return {
    id: 'audit-1',
    action: 'publication.published',
    category: 'publication',
    actor: { id: 'publisher-1', type: 'user' },
    subject: { type: 'entity', id: 'entity-1', path: 'canonicalEntities/entity-1' },
    reason: 'Approved publication',
    requestId: 'request-1',
    releaseId: 'release-1',
    correlationId: 'correlation-1',
    entityId: 'entity-1',
    idempotencyKey: 'publish:entity-1:release-1',
    occurredAt: NOW,
    ...overrides,
  };
}

function outboxMessage(overrides: Partial<OutboxMessageDoc> = {}): OutboxMessageDoc {
  return {
    id: 'outbox-1',
    eventId: 'audit-1',
    topic: 'publication.published',
    aggregateType: 'entity',
    aggregateId: 'entity-1',
    payload: { entityId: 'entity-1', releaseId: 'release-1' },
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    availableAt: NOW,
    createdAt: NOW,
    correlationId: 'correlation-1',
    idempotencyKey: 'publish:entity-1:release-1',
    ...overrides,
  };
}

test('state, audit, outbox, and idempotency marker fail atomically', async () => {
  const store = new MemoryAtomicStore();
  store.seed('canonicalEntities/entity-1', { publicationStatus: 'unpublished' });
  store.seed('auditEvents/audit-1', auditEvent());

  await assert.rejects(
    commitWithAudit(store, {
      mutations: [
        {
          operation: 'update',
          path: 'canonicalEntities/entity-1',
          data: { publicationStatus: 'published' },
        },
      ],
      auditEvent: auditEvent(),
      outboxMessage: outboxMessage(),
    }),
    /already exists/,
  );

  assert.equal(store.read('canonicalEntities/entity-1')?.publicationStatus, 'unpublished');
  assert.equal(store.read('outboxMessages/outbox-1'), undefined);
});

test('replaying an idempotency key does not duplicate state effects', async () => {
  const store = new MemoryAtomicStore();
  store.seed('canonicalEntities/entity-1', { revision: 0 });
  const first = await commitWithAudit(store, {
    mutations: [{ operation: 'update', path: 'canonicalEntities/entity-1', data: { revision: 1 } }],
    auditEvent: auditEvent(),
    outboxMessage: outboxMessage(),
  });
  const replay = await commitWithAudit(store, {
    mutations: [{ operation: 'update', path: 'canonicalEntities/entity-1', data: { revision: 2 } }],
    auditEvent: auditEvent({ id: 'audit-replay' }),
    outboxMessage: outboxMessage({ id: 'outbox-replay', eventId: 'audit-replay' }),
  });

  assert.equal(first.committed, true);
  assert.equal(replay.replayed, true);
  assert.equal(replay.eventId, 'audit-1');
  assert.equal(store.read('canonicalEntities/entity-1')?.revision, 1);
  assert.equal(store.read('auditEvents/audit-replay'), undefined);
});

test('consumer receipt prevents replayed Firestore effects', async () => {
  const store = new MemoryAtomicStore();
  store.seed('outboxMessages/outbox-1', outboxMessage());
  store.seed('projections/entity-1', { deliveries: 0 });
  let calls = 0;

  const consume = () =>
    consumeOutboxMessage(store, {
      messageId: 'outbox-1',
      consumerId: 'projection-worker',
      now: NOW,
      handle(transaction) {
        calls += 1;
        transaction.update('projections/entity-1', { deliveries: 1 });
      },
    });

  assert.equal((await consume()).status, 'processed');
  const replay = await consume();
  assert.equal(replay.replayed, true);
  assert.equal(calls, 1);
  assert.equal(store.read('projections/entity-1')?.deliveries, 1);
});

test('consumer applies bounded retries then dead-letters', async () => {
  const store = new MemoryAtomicStore();
  store.seed('outboxMessages/outbox-1', outboxMessage({ maxAttempts: 2 }));

  const failAt = (now: string) =>
    consumeOutboxMessage(store, {
      messageId: 'outbox-1',
      consumerId: 'failing-worker',
      now,
      baseRetryDelayMs: 1_000,
      handle() {
        throw new Error('temporary failure');
      },
    });

  const first = await failAt(NOW);
  assert.deepEqual([first.status, first.attempts], ['pending', 1]);
  const second = await failAt('2026-07-16T20:00:01.000Z');
  assert.deepEqual([second.status, second.attempts], ['dead_letter', 2]);
  assert.equal(store.read('outboxMessages/outbox-1')?.lastError, 'temporary failure');
});
