/**
 * In-memory transaction tests for atomic claim promotion and audit recording.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AtomicStore, AtomicTransaction } from './audit-outbox.js';
import {
  promoteClaimToPublicationCandidate,
  type PromoteClaimInput,
  type PublicationCandidateDoc,
} from './promotion.js';
import type { AuditEventDoc, OutboxMessageDoc } from './types.js';

type Operation =
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
        if (!existing) throw new Error(`Document does not exist: ${staged.path}`);
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

function candidate(): PublicationCandidateDoc {
  return {
    id: 'candidate-1',
    promotionId: 'promotion-1',
    claimId: 'claim-1',
    claimVersionId: 'claim-v1',
    policyVersion: '1.0.0',
    independentLineageCount: 3,
    confidenceThreshold: 0.85,
    preview: { added: 1, changed: 1, removed: 1, unchanged: 2 },
    createdAt: NOW,
    createdBy: 'approver-1',
  };
}

function auditEvent(): AuditEventDoc {
  return {
    id: 'audit-promotion-1',
    action: 'moderation.approved',
    category: 'moderation',
    actor: { id: 'approver-1', type: 'user' },
    subject: {
      type: 'claimPromotion',
      id: 'promotion-1',
      path: 'claimPromotions/promotion-1',
    },
    reason: 'Deterministic promotion controls passed',
    requestId: 'request-1',
    correlationId: 'correlation-1',
    idempotencyKey: 'promotion:promotion-1:candidate-1',
    occurredAt: NOW,
    data: { stage: 'publication_candidate', policyVersion: '1.0.0' },
  };
}

function outboxMessage(): OutboxMessageDoc {
  return {
    id: 'outbox-promotion-1',
    eventId: 'audit-promotion-1',
    topic: 'claim.promotion.publication_candidate',
    aggregateType: 'publicationCandidate',
    aggregateId: 'candidate-1',
    payload: {
      promotionId: 'promotion-1',
      claimId: 'claim-1',
      releaseCandidateId: 'candidate-1',
    },
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    availableAt: NOW,
    createdAt: NOW,
    correlationId: 'correlation-1',
    idempotencyKey: 'promotion:promotion-1:candidate-1',
  };
}

function input(): PromoteClaimInput {
  return {
    promotionId: 'promotion-1',
    candidate: candidate(),
    gate: {
      approved: true,
      deterministic: true,
      policyVersion: '1.0.0',
      reasons: [],
      independentLineageCount: 3,
      confidenceThreshold: 0.85,
    },
    now: NOW,
    auditEvent: auditEvent(),
    outboxMessage: outboxMessage(),
  };
}

function seedAccepted(store: MemoryAtomicStore, proposerId = 'researcher-1'): void {
  store.seed('claimPromotions/promotion-1', {
    id: 'promotion-1',
    stage: 'accepted_claim',
    claimId: 'claim-1',
    claimVersionId: 'claim-v1',
    proposerId,
    approverId: 'approver-1',
    updatedAt: NOW,
  });
}

test('promotion, candidate, audit, outbox, and marker commit atomically', async () => {
  const store = new MemoryAtomicStore();
  seedAccepted(store);

  const result = await promoteClaimToPublicationCandidate(store, input());

  assert.equal(result.committed, true);
  assert.equal(store.read('claimPromotions/promotion-1')?.stage, 'publication_candidate');
  assert.equal(store.read('claimPromotions/promotion-1')?.releaseCandidateId, 'candidate-1');
  assert.ok(store.read('publicationCandidates/candidate-1'));
  assert.ok(store.read('auditEvents/audit-promotion-1'));
  assert.ok(store.read('outboxMessages/outbox-promotion-1'));
});

test('failed deterministic gate performs no writes', async () => {
  const store = new MemoryAtomicStore();
  seedAccepted(store);

  await assert.rejects(
    promoteClaimToPublicationCandidate(store, {
      ...input(),
      gate: {
        ...input().gate,
        approved: false,
        reasons: ['insufficient_independent_lineages'],
      },
    }),
    /approved deterministic gate/,
  );

  assert.equal(store.read('claimPromotions/promotion-1')?.stage, 'accepted_claim');
  assert.equal(store.read('publicationCandidates/candidate-1'), undefined);
  assert.equal(store.read('auditEvents/audit-promotion-1'), undefined);
});

test('proposer cannot serve as approver', async () => {
  const store = new MemoryAtomicStore();
  seedAccepted(store, 'approver-1');

  await assert.rejects(
    promoteClaimToPublicationCandidate(store, input()),
    /separate recorded approver/,
  );

  assert.equal(store.read('claimPromotions/promotion-1')?.stage, 'accepted_claim');
});

test('idempotency replay does not create a second audit event', async () => {
  const store = new MemoryAtomicStore();
  seedAccepted(store);

  const first = await promoteClaimToPublicationCandidate(store, input());
  const replay = await promoteClaimToPublicationCandidate(store, input());

  assert.equal(first.committed, true);
  assert.equal(replay.replayed, true);
  assert.ok(store.read('auditEvents/audit-promotion-1'));
});

test('candidate preview and gate evidence must match the audited envelope', async () => {
  const store = new MemoryAtomicStore();
  seedAccepted(store);

  await assert.rejects(
    promoteClaimToPublicationCandidate(store, {
      ...input(),
      candidate: { ...candidate(), independentLineageCount: 2 },
    }),
    /must match the deterministic gate/,
  );
});
