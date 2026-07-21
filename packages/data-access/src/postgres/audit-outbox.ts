/** Postgres-only atomic commit contract for canonical ledger writes. */
import type { DomainAuditEvent, DomainOutboxMessage } from '@repo/domain';

export type AtomicSnapshot = { readonly exists: boolean; data(): unknown };
export type AtomicTransaction = {
  get(path: string): Promise<AtomicSnapshot>;
  create(path: string, data: Readonly<Record<string, unknown>>): void;
  set(path: string, data: Readonly<Record<string, unknown>>): void;
  update(path: string, data: Readonly<Record<string, unknown>>): void;
};
export type AtomicStore = {
  runTransaction<T>(operation: (transaction: AtomicTransaction) => Promise<T>): Promise<T>;
};
export type StateMutation = {
  readonly operation: 'create' | 'set' | 'update';
  readonly path: string;
  readonly data: Readonly<Record<string, unknown>>;
};
export type CommitWithAuditInput = {
  readonly mutations: readonly StateMutation[];
  readonly auditEvent: DomainAuditEvent;
  readonly outboxMessage: DomainOutboxMessage;
};
export type CommitWithAuditResult = {
  readonly committed: boolean;
  readonly replayed: boolean;
  readonly eventId: string;
  readonly outboxMessageId: string;
};

const PROTECTED_ROOTS = new Set(['auditEvents', 'outboxMessages', 'idempotencyKeys']);

function assertDocumentPath(path: string): void {
  const segments = path.split('/');
  if (
    path.startsWith('/') ||
    path.endsWith('/') ||
    segments.some((segment) => segment.length === 0) ||
    segments.length % 2 !== 0
  )
    throw new Error(`Expected an even-segment canonical ledger path: ${path}`);
}

function assertStateMutationAllowed(mutation: StateMutation): void {
  assertDocumentPath(mutation.path);
  const [root] = mutation.path.split('/');
  if (root && PROTECTED_ROOTS.has(root)) {
    throw new Error(`State mutations cannot target protected ledger root ${root}`);
  }
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) throw new Error(`${field} is required`);
}

function assertIsoDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO date-time`);
}

function validateInput(input: CommitWithAuditInput): void {
  const { auditEvent, outboxMessage } = input;
  requireText(auditEvent.id, 'auditEvent.id');
  requireText(auditEvent.idempotencyKey, 'auditEvent.idempotencyKey');
  requireText(auditEvent.correlationId, 'auditEvent.correlationId');
  requireText(auditEvent.reason, 'auditEvent.reason');
  assertIsoDate(auditEvent.occurredAt, 'auditEvent.occurredAt');
  requireText(outboxMessage.id, 'outboxMessage.id');
  assertIsoDate(outboxMessage.availableAt, 'outboxMessage.availableAt');
  assertIsoDate(outboxMessage.createdAt, 'outboxMessage.createdAt');
  input.mutations.forEach(assertStateMutationAllowed);
  if (outboxMessage.eventId !== auditEvent.id)
    throw new Error('Outbox eventId must match audit event id');
  if (outboxMessage.idempotencyKey !== auditEvent.idempotencyKey)
    throw new Error('Outbox and audit event idempotency keys must match');
  if (outboxMessage.correlationId !== auditEvent.correlationId)
    throw new Error('Outbox and audit event correlation ids must match');
  if (outboxMessage.status !== 'pending' || outboxMessage.attempts !== 0)
    throw new Error('New outbox messages must start pending with zero attempts');
  if (!Number.isInteger(outboxMessage.maxAttempts) || outboxMessage.maxAttempts < 1)
    throw new Error('Outbox maxAttempts must be a positive integer');
}

function idempotencyPath(key: string): string {
  return `idempotencyKeys/${Buffer.from(key, 'utf8').toString('base64url')}`;
}

/** Atomically writes state, immutable audit/outbox rows, and an idempotency marker. */
export async function commitWithAudit(
  store: AtomicStore,
  input: CommitWithAuditInput,
): Promise<CommitWithAuditResult> {
  validateInput(input);
  const { auditEvent, outboxMessage } = input;
  return store.runTransaction(async (transaction) => {
    const markerPath = idempotencyPath(auditEvent.idempotencyKey);
    const existing = await transaction.get(markerPath);
    if (existing.exists) {
      const marker = existing.data() as {
        readonly eventId?: unknown;
        readonly outboxMessageId?: unknown;
      };
      if (typeof marker.eventId !== 'string' || typeof marker.outboxMessageId !== 'string')
        throw new Error('Stored idempotency marker is invalid');
      return {
        committed: false,
        replayed: true,
        eventId: marker.eventId,
        outboxMessageId: marker.outboxMessageId,
      };
    }
    for (const mutation of input.mutations)
      transaction[mutation.operation](mutation.path, mutation.data);
    transaction.create(`auditEvents/${auditEvent.id}`, auditEvent);
    transaction.create(`outboxMessages/${outboxMessage.id}`, outboxMessage);
    transaction.create(markerPath, {
      key: auditEvent.idempotencyKey,
      eventId: auditEvent.id,
      outboxMessageId: outboxMessage.id,
      correlationId: auditEvent.correlationId,
      createdAt: auditEvent.occurredAt,
    });
    return {
      committed: true,
      replayed: false,
      eventId: auditEvent.id,
      outboxMessageId: outboxMessage.id,
    };
  });
}
