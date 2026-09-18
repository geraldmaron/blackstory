/** Job audit events and outbox messages share a correlation ID and commit atomically. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commitWithAudit, type AtomicStore, type AtomicTransaction } from '@repo/data-access';
import { buildJobRunAuditEvent, buildJobRunOutboxMessage } from './audit.ts';

type StagedOperation =
  | {
      readonly kind: 'create' | 'set';
      readonly path: string;
      readonly data: Readonly<Record<string, unknown>>;
    }
  | {
      readonly kind: 'update';
      readonly path: string;
      readonly data: Readonly<Record<string, unknown>>;
    };

/** Minimal in-memory AtomicStore double, for testing atomic commits. */
class MemoryAtomicStore implements AtomicStore {
  private documents = new Map<string, Readonly<Record<string, unknown>>>();

  read(path: string): Readonly<Record<string, unknown>> | undefined {
    return this.documents.get(path);
  }

  async runTransaction<T>(operation: (transaction: AtomicTransaction) => Promise<T>): Promise<T> {
    const staged: StagedOperation[] = [];
    const transaction: AtomicTransaction = {
      get: async (path) => {
        const value = this.documents.get(path);
        return { exists: value !== undefined, data: () => value };
      },
      create: (path, data) => staged.push({ kind: 'create', path, data }),
      set: (path, data) => staged.push({ kind: 'set', path, data }),
      update: (path, data) => staged.push({ kind: 'update', path, data }),
    };
    const result = await operation(transaction);
    for (const op of staged) {
      const existing = this.documents.get(op.path);
      this.documents.set(op.path, op.kind === 'update' ? { ...existing, ...op.data } : op.data);
    }
    return result;
  }
}

test('a job-run audit event and outbox message are accepted by the real commitWithAudit unmodified', async () => {
  const jobRunId = 'jobrun_2026-07-17T04-00-00Z_source-drift-daily';
  const auditEvent = buildJobRunAuditEvent({
    jobRunId,
    action: 'research.completed',
    actor: { id: 'scheduled-job:source-drift-daily', type: 'system' },
    subject: { type: 'job-run', id: jobRunId, path: `jobRuns/${jobRunId}` },
    reason: 'Source drift review completed',
    occurredAt: '2026-07-17T04:05:00.000Z',
  });
  const outboxMessage = buildJobRunOutboxMessage({
    auditEvent,
    outboxMessageId: `outbox_${jobRunId}`,
    topic: 'job-run.completed',
    aggregateType: 'job-run',
    aggregateId: jobRunId,
    payload: { jobId: 'source-drift-daily' },
    createdAt: '2026-07-17T04:05:00.000Z',
  });

  const store = new MemoryAtomicStore();
  const result = await commitWithAudit(store, {
    mutations: [
      {
        operation: 'set',
        path: `jobRuns/${jobRunId}`,
        data: { jobId: 'source-drift-daily', status: 'success' },
      },
    ],
    auditEvent,
    outboxMessage,
  });

  assert.equal(result.committed, true);
  assert.equal(result.eventId, auditEvent.id);
  assert.equal(result.outboxMessageId, outboxMessage.id);

  // The write, the audit event, and the outbox message all carry the same correlation id the
  // job-run id so the write is traceable back to the exact run that made it.
  assert.equal(auditEvent.correlationId, jobRunId);
  assert.equal(outboxMessage.correlationId, jobRunId);
  const written = store.read(`jobRuns/${jobRunId}`);
  assert.ok(written);

  const storedAudit = store.read(`auditEvents/${auditEvent.id}`);
  assert.equal(storedAudit?.correlationId, jobRunId);
});

test('replaying the same job-run write is idempotent (same idempotency key returns the original ids)', async () => {
  const jobRunId = 'jobrun_replay_test';
  const auditEvent = buildJobRunAuditEvent({
    jobRunId,
    action: 'research.completed',
    actor: { id: 'scheduled-job:gold-corpus-regression', type: 'system' },
    subject: { type: 'job-run', id: jobRunId, path: `jobRuns/${jobRunId}` },
    reason: 'Scheduled gold-corpus regression completed',
    occurredAt: '2026-07-17T03:05:00.000Z',
  });
  const outboxMessage = buildJobRunOutboxMessage({
    auditEvent,
    outboxMessageId: `outbox_${jobRunId}`,
    topic: 'job-run.completed',
    aggregateType: 'job-run',
    aggregateId: jobRunId,
    payload: {},
    createdAt: '2026-07-17T03:05:00.000Z',
  });

  const store = new MemoryAtomicStore();
  const input = {
    mutations: [{ operation: 'set' as const, path: `jobRuns/${jobRunId}`, data: { attempt: 1 } }],
    auditEvent,
    outboxMessage,
  };
  const first = await commitWithAudit(store, input);
  const second = await commitWithAudit(store, input);
  assert.equal(first.committed, true);
  assert.equal(second.committed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.eventId, first.eventId);
});
