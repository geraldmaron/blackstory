/**
 * Verifies commitOperatorIntake calls the real commitWithAudit atomically, including
 * idempotent replay on a repeated call proving this package does not reimplement that path.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AtomicStore, AtomicTransaction } from '@repo/firebase';
import { commitOperatorIntake } from './commit.ts';
import { prepareLeadIntake, type OperatorIntakeAccepted } from './intake.ts';

type Operation =
  | { kind: 'create' | 'set'; path: string; data: Readonly<Record<string, unknown>> }
  | { kind: 'update'; path: string; data: Readonly<Record<string, unknown>> };

class MemoryAtomicStore implements AtomicStore {
  private documents = new Map<string, Readonly<Record<string, unknown>>>();

  has(path: string): boolean {
    return this.documents.has(path);
  }

  async runTransaction<T>(operation: (transaction: AtomicTransaction) => Promise<T>): Promise<T> {
    const operations: Operation[] = [];
    const transaction: AtomicTransaction = {
      get: async (path) => {
        const value = this.documents.get(path);
        return { exists: value !== undefined, data: () => value };
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
      next.set(staged.path, structuredClone(staged.data));
    }
    this.documents = next;
    return result;
  }
}

function acceptedLead(): OperatorIntakeAccepted {
  const outcome = prepareLeadIntake(
    {
      description: 'A lead with a citation, used to exercise the real commit path.',
      url: 'https://archive.example.org/commit-test',
    },
    {
      identity: { operatorId: 'operator-1', sessionId: 'session-1', source: 'cli' },
      privacyPepper: 'test-only-pepper',
      nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
    },
  );
  assert.equal(outcome.accepted, true);
  if (!outcome.accepted) throw new Error('expected accepted outcome');
  return outcome;
}

test('commits the submission and research-case mutations plus one audit event and outbox message', async () => {
  const store = new MemoryAtomicStore();
  const outcome = acceptedLead();
  const result = await commitOperatorIntake(store, outcome);
  assert.equal(result.committed, true);
  assert.equal(result.replayed, false);
  for (const mutation of outcome.mutations) {
    assert.equal(store.has(mutation.path), true);
  }
  assert.equal(store.has(`auditEvents/${outcome.auditEvent.id}`), true);
  assert.equal(store.has(`outboxMessages/${outcome.outboxMessage.id}`), true);
});

test('committing the same prepared outcome twice replays instead of double-writing', async () => {
  const store = new MemoryAtomicStore();
  const outcome = acceptedLead();
  const first = await commitOperatorIntake(store, outcome);
  const second = await commitOperatorIntake(store, outcome);
  assert.equal(first.committed, true);
  assert.equal(second.committed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.eventId, first.eventId);
});
