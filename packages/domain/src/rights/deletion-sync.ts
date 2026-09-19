/** Store-independent purge planning for source deletion obligations. Produces audit/outbox
 * records without retaining removed content. Adapters must execute and acknowledge the plan;
 * creating a plan does not prove deletion from storage or derived indexes. */
import { randomUUID } from 'node:crypto';
import {
  auditCategoryFor,
  type AuditActor,
  type DomainAuditEvent,
  type DomainOutboxMessage,
} from '../audit/index.js';

export const DELETION_SYNC_CASCADE_KINDS = [
  'quarantine',
  'graylist',
  'research_case_attachment',
] as const;

export type DeletionSyncCascadeKind = (typeof DELETION_SYNC_CASCADE_KINDS)[number];

export type DeletionSyncCascadeTarget = {
  readonly kind: DeletionSyncCascadeKind;
  /** Store-agnostic path the executing adapter purges (e.g. a resource path). */
  readonly path: string;
  readonly id: string;
};

export type DeletionSyncRequest = {
  readonly sourceId: string;
  readonly adapterId: string;
  readonly reason: string;
  readonly correlationId: string;
  readonly requestedAt: string;
  readonly actor: AuditActor;
  readonly cascadeTargets: readonly DeletionSyncCascadeTarget[];
};

/** Domain-level purge instruction; a storage adapter maps this onto its own write API. */
export type DeletionSyncMutation = {
  readonly kind: DeletionSyncCascadeKind;
  readonly path: string;
  readonly operation: 'purge';
};

/** The fact of deletion only never the deleted content. A queryable audit-of-deletion record. */
export type DeletionSyncRecord = {
  readonly id: string;
  readonly sourceId: string;
  readonly adapterId: string;
  readonly reason: string;
  readonly correlationId: string;
  readonly purgedAt: string;
  readonly purgedTargetCount: number;
  readonly purgedTargetRefs: readonly DeletionSyncCascadeTarget[];
};

export type DeletionSyncPlan = {
  readonly mutations: readonly DeletionSyncMutation[];
  readonly record: DeletionSyncRecord;
  readonly auditEvent: DomainAuditEvent;
  readonly outboxMessage: DomainOutboxMessage;
};

/**
 * Build a purge plan for a deletion-sync request. Pure function: no I/O, no scheduler
 * dependency, callable by a cron handler or an operator CLI identically. Callers execute
 * `mutations` against their own store and persist `auditEvent` `outboxMessage` through the
 * existing commit path.
 */
export function planDeletionSyncPurge(request: DeletionSyncRequest): DeletionSyncPlan {
  if (!request.cascadeTargets.length) {
    throw new Error('Deletion-sync purge requires at least one cascade target');
  }

  const id = randomUUID();
  const mutations: DeletionSyncMutation[] = request.cascadeTargets.map((target) => ({
    kind: target.kind,
    path: target.path,
    operation: 'purge',
  }));

  const record: DeletionSyncRecord = {
    id,
    sourceId: request.sourceId,
    adapterId: request.adapterId,
    reason: request.reason,
    correlationId: request.correlationId,
    purgedAt: request.requestedAt,
    purgedTargetCount: request.cascadeTargets.length,
    purgedTargetRefs: request.cascadeTargets,
  };

  const action = 'deletion.purged' as const;
  const auditEvent: DomainAuditEvent = {
    id,
    action,
    category: auditCategoryFor(action),
    actor: request.actor,
    subject: { type: 'source', id: request.sourceId, path: `evidenceSources/${request.sourceId}` },
    reason: request.reason,
    requestId: id,
    correlationId: request.correlationId,
    idempotencyKey: `deletion-sync:${request.sourceId}:${request.correlationId}`,
    occurredAt: request.requestedAt,
    data: {
      adapterId: request.adapterId,
      purgedTargetCount: record.purgedTargetCount,
      purgedTargetRefs: record.purgedTargetRefs,
    },
  };

  const outboxMessage: DomainOutboxMessage = {
    id: `${id}-outbox`,
    eventId: id,
    topic: 'deletion-sync.purged',
    aggregateType: 'evidenceSource',
    aggregateId: request.sourceId,
    payload: {
      sourceId: request.sourceId,
      adapterId: request.adapterId,
      correlationId: request.correlationId,
      purgedTargetCount: record.purgedTargetCount,
    },
    status: 'pending',
    attempts: 0,
    maxAttempts: 5,
    availableAt: request.requestedAt,
    createdAt: request.requestedAt,
    correlationId: request.correlationId,
    idempotencyKey: `deletion-sync:${request.sourceId}:${request.correlationId}`,
  };

  return { mutations, record, auditEvent, outboxMessage };
}

/** Minimal store contract a purge executor needs; kept generic so callers can use any keyed store. */
export type PurgeableStore = {
  delete(path: string): void;
};

/**
 * Apply a purge plan's mutations against any store exposing `delete`. Scheduler-agnostic: a
 * cron job or a manual operator invocation can call this the same way.
 */
export function applyDeletionSyncPurge(store: PurgeableStore, plan: DeletionSyncPlan): void {
  for (const mutation of plan.mutations) {
    store.delete(mutation.path);
  }
}
