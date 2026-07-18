
/**
 * Builds job-run audit events and outbox messages using the exact DomainAuditEvent
 * DomainOutboxMessage shapes (packages/domain/src/audit/index.ts) that
 * @repo/firebase's commitWithAudit (packages/firebase/src/firestore/audit-outbox.ts)
 * consumes unmodified.
 *
 * This module deliberately does NOT depend on @repo/firebase at runtime pulling
 * firebase-admin into the operational-config layer would be architecturally wrong for a package
 * other lightweight surfaces (web, edge) may also import. It only builds plain,
 * framework-independent objects matching commitWithAudit's exact calling convention; the worker
 * or app that actually performs the Firestore write already depends on @repo/firebase and
 * passes the objects built here straight through. audit.test.ts proves this concretely by
 * importing the real commitWithAudit (as a devDependency-only, test-time import) and calling it
 * with objects built by this module, unmodified.
 *
 * The load-bearing invariant: correlationId === jobRunId on both the audit event and the outbox
 * message. Every automated write a scheduled job makes carries its run id as the
 * correlation id, so it is traceable back to the exact run that made it (.
 */
import { auditCategoryFor } from '@repo/domain';
import type { AuditActor, AuditEventAction, DomainAuditEvent, DomainOutboxMessage } from '@repo/domain';

export type BuildJobRunAuditEventInput = {
  readonly jobRunId: string;
  readonly action: AuditEventAction;
  readonly actor: AuditActor;
  readonly subject: { readonly type: string; readonly id: string; readonly path: string };
  readonly reason: string;
  readonly occurredAt: string;
  readonly releaseId?: string;
  readonly entityId?: string;
  readonly data?: Readonly<Record<string, unknown>>;
};

export function buildJobRunAuditEvent(input: BuildJobRunAuditEventInput): DomainAuditEvent {
  return {
    id: `audit_${input.jobRunId}_${input.action}`,
    action: input.action,
    category: auditCategoryFor(input.action),
    actor: input.actor,
    subject: input.subject,
    reason: input.reason,
    // Scheduled jobs have no originating HTTP request; the job-run id doubles as requestId
    // a Cloud Tasks dispatch is effectively "the request" that produced this write.
    requestId: input.jobRunId,
    correlationId: input.jobRunId,
    idempotencyKey: `job-run:${input.jobRunId}:${input.action}:${input.subject.id}`,
    occurredAt: input.occurredAt,
    ...(input.releaseId === undefined ? {} : { releaseId: input.releaseId }),
    ...(input.entityId === undefined ? {} : { entityId: input.entityId }),
    ...(input.data === undefined ? {} : { data: input.data }),
  };
}

export type BuildJobRunOutboxMessageInput = {
  readonly auditEvent: DomainAuditEvent;
  readonly outboxMessageId: string;
  readonly topic: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly maxAttempts?: number;
};

export function buildJobRunOutboxMessage(input: BuildJobRunOutboxMessageInput): DomainOutboxMessage {
  return {
    id: input.outboxMessageId,
    eventId: input.auditEvent.id,
    topic: input.topic,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    status: 'pending',
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 5,
    availableAt: input.createdAt,
    createdAt: input.createdAt,
    correlationId: input.auditEvent.correlationId,
    idempotencyKey: input.auditEvent.idempotencyKey,
  };
}
