
/**
 * Thin audit/outbox builders for operator proposals.
 *
 * These functions only *shape data* to the contract `commitWithAudit`
 * (packages/firebase/src/firestore/audit-outbox.ts) already enforces they do not
 * reimplement audit, outbox, or idempotency semantics. The actual atomic write happens in
 * `./commit.ts`, which calls the real `commitWithAudit`.
 */
import { randomUUID } from 'node:crypto';
import {
  auditCategoryFor,
  type AuditEventAction,
  type AuditSubject,
  type DomainAuditEvent,
  type DomainOutboxMessage,
} from '@repo/domain';
import { buildOperatorActor, type OperatorIdentity } from './identity.js';

export type BuildOperatorAuditEventInput = {
  readonly action: AuditEventAction;
  readonly subject: AuditSubject;
  readonly identity: OperatorIdentity;
  readonly reason: string;
  readonly now: string;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly entityId?: string;
  readonly data?: Readonly<Record<string, unknown>>;
};

/** Builds one immutable audit event, actor-stamped with the proposing operator. */
export function buildOperatorAuditEvent(input: BuildOperatorAuditEventInput): DomainAuditEvent {
  return {
    id: randomUUID(),
    action: input.action,
    category: auditCategoryFor(input.action),
    actor: buildOperatorActor(input.identity),
    subject: input.subject,
    reason: input.reason,
    requestId: randomUUID(),
    correlationId: input.correlationId ?? input.idempotencyKey,
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.now,
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.data ? { data: input.data } : {}),
  };
}

export type BuildOperatorOutboxMessageInput = {
  readonly auditEvent: DomainAuditEvent;
  readonly topic: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly now: string;
  readonly maxAttempts?: number;
};

/** Builds one pending outbox message paired to the audit event above. */
export function buildOperatorOutboxMessage(
  input: BuildOperatorOutboxMessageInput,
): DomainOutboxMessage {
  return {
    id: randomUUID(),
    eventId: input.auditEvent.id,
    topic: input.topic,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    status: 'pending',
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 8,
    availableAt: input.now,
    createdAt: input.now,
    correlationId: input.auditEvent.correlationId,
    idempotencyKey: input.auditEvent.idempotencyKey,
  };
}
