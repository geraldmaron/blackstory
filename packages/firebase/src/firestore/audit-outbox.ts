
/**
 * Firestore transaction helpers for append-only audit events and outbox delivery.
 * Consumer handlers may stage Firestore writes only; external I/O belongs in a later Cloud Tasks adapter.
 */
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { reconstructPublicationHistory, type PublicationHistoryEntry } from '@repo/domain';
import {
  auditEventSchema,
  idempotencyRecordSchema,
  outboxConsumerReceiptSchema,
  outboxMessageSchema,
  type AuditEventDoc,
  type IdempotencyRecordDoc,
  type OutboxMessageDoc,
} from './types.js';

export type AtomicSnapshot = {
  readonly exists: boolean;
  data(): unknown;
};

export type AtomicTransaction = {
  get(path: string): Promise<AtomicSnapshot>;
  create(path: string, data: Readonly<Record<string, unknown>>): void;
  set(path: string, data: Readonly<Record<string, unknown>>): void;
  update(path: string, data: Readonly<Record<string, unknown>>): void;
};

export type AtomicStore = {
  runTransaction<T>(operation: (transaction: AtomicTransaction) => Promise<T>): Promise<T>;
};

export type StateMutation =
  | {
      readonly operation: 'create' | 'set';
      readonly path: string;
      readonly data: Readonly<Record<string, unknown>>;
    }
  | {
      readonly operation: 'update';
      readonly path: string;
      readonly data: Readonly<Record<string, unknown>>;
    };

export type CommitWithAuditInput = {
  readonly mutations: readonly StateMutation[];
  readonly auditEvent: AuditEventDoc;
  readonly outboxMessage: OutboxMessageDoc;
};

export type CommitWithAuditResult = {
  readonly committed: boolean;
  readonly replayed: boolean;
  readonly eventId: string;
  readonly outboxMessageId: string;
};

export type ConsumeOutboxResult = {
  readonly status: 'processed' | 'pending' | 'dead_letter' | 'not_ready' | 'missing';
  readonly attempts: number;
  readonly replayed: boolean;
};

const PROTECTED_ROOTS = new Set([
  'auditEvents',
  'outboxMessages',
  'idempotencyKeys',
  'outboxConsumerReceipts',
]);

function assertDocumentPath(path: string): void {
  const segments = path.split('/');
  if (
    path.startsWith('/') ||
    path.endsWith('/') ||
    segments.some((segment) => segment.length === 0) ||
    segments.length % 2 !== 0
  ) {
    throw new Error(`Expected an even-segment Firestore document path: ${path}`);
  }
}

function assertStateMutationAllowed(mutation: StateMutation): void {
  assertDocumentPath(mutation.path);
  const [root] = mutation.path.split('/');
  if (root && PROTECTED_ROOTS.has(root)) {
    throw new Error(`State mutations cannot target protected collection ${root}`);
  }
}

function keyDocumentId(key: string): string {
  return Buffer.from(key, 'utf8').toString('base64url');
}

function idempotencyPath(key: string): string {
  return `idempotencyKeys/${keyDocumentId(key)}`;
}

function consumerReceiptPath(consumerId: string, messageId: string): string {
  return `outboxConsumerReceipts/${keyDocumentId(`${consumerId}:${messageId}`)}`;
}

export function createAdminAtomicStore(firestore: Firestore): AtomicStore {
  return {
    runTransaction<T>(operation: (transaction: AtomicTransaction) => Promise<T>): Promise<T> {
      return firestore.runTransaction((transaction) =>
        operation({
          async get(path) {
            assertDocumentPath(path);
            return transaction.get(firestore.doc(path));
          },
          create(path, data) {
            assertDocumentPath(path);
            transaction.create(firestore.doc(path), data as DocumentData);
          },
          set(path, data) {
            assertDocumentPath(path);
            transaction.set(firestore.doc(path), data as DocumentData);
          },
          update(path, data) {
            assertDocumentPath(path);
            transaction.update(firestore.doc(path), data as DocumentData);
          },
        }),
      );
    },
  };
}


/**
 * Atomically commits domain state, one immutable audit event, one pending outbox message,
 * and the idempotency record. A repeated key returns the original ids without writing.
 */
export async function commitWithAudit(
  store: AtomicStore,
  input: CommitWithAuditInput,
): Promise<CommitWithAuditResult> {
  const auditEvent = auditEventSchema.parse(input.auditEvent);
  const outboxMessage = outboxMessageSchema.parse(input.outboxMessage);
  input.mutations.forEach(assertStateMutationAllowed);

  if (outboxMessage.eventId !== auditEvent.id) {
    throw new Error('Outbox eventId must match audit event id');
  }
  if (outboxMessage.idempotencyKey !== auditEvent.idempotencyKey) {
    throw new Error('Outbox and audit event idempotency keys must match');
  }
  if (outboxMessage.correlationId !== auditEvent.correlationId) {
    throw new Error('Outbox and audit event correlation ids must match');
  }
  if (outboxMessage.status !== 'pending' || outboxMessage.attempts !== 0) {
    throw new Error('New outbox messages must start pending with zero attempts');
  }

  return store.runTransaction(async (transaction) => {
    const markerPath = idempotencyPath(auditEvent.idempotencyKey);
    const existing = await transaction.get(markerPath);
    if (existing.exists) {
      const marker = idempotencyRecordSchema.parse(existing.data());
      return {
        committed: false,
        replayed: true,
        eventId: marker.eventId,
        outboxMessageId: marker.outboxMessageId,
      };
    }

    for (const mutation of input.mutations) {
      transaction[mutation.operation](mutation.path, mutation.data);
    }

    const marker: IdempotencyRecordDoc = {
      key: auditEvent.idempotencyKey,
      eventId: auditEvent.id,
      outboxMessageId: outboxMessage.id,
      correlationId: auditEvent.correlationId,
      createdAt: auditEvent.occurredAt,
    };
    transaction.create(`auditEvents/${auditEvent.id}`, auditEvent);
    transaction.create(`outboxMessages/${outboxMessage.id}`, outboxMessage);
    transaction.create(markerPath, marker);

    return {
      committed: true,
      replayed: false,
      eventId: auditEvent.id,
      outboxMessageId: outboxMessage.id,
    };
  });
}

class OutboxHandlerError extends Error {
  constructor(readonly handlerCause: unknown) {
    super('Outbox handler failed');
  }
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 2_000) || 'Unknown consumer failure';
}


/**
 * Consumes a message with an atomic Firestore effect + receipt. The handler must only use the
 * supplied transaction and must not perform external I/O because Firestore may retry callbacks.
 */
export async function consumeOutboxMessage(
  store: AtomicStore,
  input: {
    readonly messageId: string;
    readonly consumerId: string;
    readonly now: string;
    readonly baseRetryDelayMs?: number;
    readonly maxRetryDelayMs?: number;
    readonly handle: (
      transaction: AtomicTransaction,
      message: OutboxMessageDoc,
    ) => Promise<void> | void;
  },
): Promise<ConsumeOutboxResult> {
  const messagePath = `outboxMessages/${input.messageId}`;
  const receiptPath = consumerReceiptPath(input.consumerId, input.messageId);

  try {
    return await store.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(messagePath);
      if (!snapshot.exists) {
        return { status: 'missing', attempts: 0, replayed: false };
      }

      const message = outboxMessageSchema.parse(snapshot.data());
      if (message.status === 'processed') {
        return { status: 'processed', attempts: message.attempts, replayed: true };
      }
      if (message.status === 'dead_letter') {
        return { status: 'dead_letter', attempts: message.attempts, replayed: true };
      }
      if (Date.parse(message.availableAt) > Date.parse(input.now)) {
        return { status: 'not_ready', attempts: message.attempts, replayed: false };
      }

      const receipt = await transaction.get(receiptPath);
      if (receipt.exists) {
        transaction.update(messagePath, {
          status: 'processed',
          processedAt: input.now,
        });
        return { status: 'processed', attempts: message.attempts, replayed: true };
      }

      try {
        await input.handle(transaction, message);
      } catch (error) {
        throw new OutboxHandlerError(error);
      }

      transaction.create(
        receiptPath,
        outboxConsumerReceiptSchema.parse({
          id: receiptPath.slice(receiptPath.indexOf('/') + 1),
          consumerId: input.consumerId,
          messageId: message.id,
          eventId: message.eventId,
          processedAt: input.now,
        }),
      );
      transaction.update(messagePath, {
        status: 'processed',
        processedAt: input.now,
        attempts: message.attempts + 1,
      });
      return { status: 'processed', attempts: message.attempts + 1, replayed: false };
    });
  } catch (error) {
    if (!(error instanceof OutboxHandlerError)) {
      throw error;
    }

    return store.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(messagePath);
      if (!snapshot.exists) {
        return { status: 'missing', attempts: 0, replayed: false };
      }
      const message = outboxMessageSchema.parse(snapshot.data());
      if (message.status !== 'pending') {
        return {
          status: message.status,
          attempts: message.attempts,
          replayed: true,
        };
      }

      const attempts = message.attempts + 1;
      const deadLetter = attempts >= message.maxAttempts;
      const baseDelay = input.baseRetryDelayMs ?? 1_000;
      const maxDelay = input.maxRetryDelayMs ?? 15 * 60_000;
      const delay = Math.min(maxDelay, baseDelay * 2 ** Math.max(0, attempts - 1));
      transaction.update(messagePath, {
        status: deadLetter ? 'dead_letter' : 'pending',
        attempts,
        availableAt: new Date(Date.parse(input.now) + delay).toISOString(),
        lastError: errorMessage(error.handlerCause),
      });
      return {
        status: deadLetter ? 'dead_letter' : 'pending',
        attempts,
        replayed: false,
      };
    });
  }
}


/**
 * Loads all audit events for an entity and reconstructs publication/correction/retraction history.
 */
export async function loadEntityPublicationHistory(
  firestore: Firestore,
  entityId: string,
): Promise<readonly PublicationHistoryEntry[]> {
  const snapshot = await firestore
    .collection('auditEvents')
    .where('entityId', '==', entityId)
    .orderBy('occurredAt', 'asc')
    .get();
  const events = snapshot.docs.map((document) => auditEventSchema.parse(document.data()));
  return reconstructPublicationHistory(entityId, events);
}
