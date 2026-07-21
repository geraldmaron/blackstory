/**
 * Bulk admin decisions on published catalog entities (flag for retraction, needs review,
 * clear). Mirrors the research-case bulk-transition and story-packet bulk-review pattern:
 * this records an audited DECISION only — it never mutates the entity or a release directly.
 * Writes only to Postgres (bb_ops.catalog_decisions).
 */
import { randomUUID } from 'node:crypto';
import { auditCategoryFor } from '@repo/domain';
import { ledgerPaths } from '@repo/data-access';
import { commitWithAuditPostgres } from '@/lib/postgres-commit';
import {
  listCatalogDecisionsPostgres,
  writeCatalogDecisionPostgres,
} from '@/lib/postgres-catalog';

export const CATALOG_BULK_DECISION_LIMIT = 50;

export const CATALOG_DECISION_ACTIONS = [
  'flag_for_retraction',
  'needs_review',
  'clear_flag',
] as const;
export type CatalogDecisionAction = (typeof CATALOG_DECISION_ACTIONS)[number];

export type CatalogDecisionRecord = {
  readonly entityId: string;
  readonly action: CatalogDecisionAction;
  readonly reason: string;
  readonly decidedByUid: string;
  readonly decidedByEmail: string;
  readonly decidedAt: string;
};

function auditActionFor(
  action: CatalogDecisionAction,
): 'moderation.escalated' | 'moderation.approved' {
  return action === 'clear_flag' ? 'moderation.approved' : 'moderation.escalated';
}

export function assertCatalogBulkSelection(
  entityIds: readonly string[],
  limit = CATALOG_BULK_DECISION_LIMIT,
): readonly string[] {
  if (entityIds.length === 0) {
    throw new Error('Select at least one entity for a bulk decision');
  }
  if (entityIds.length > limit) {
    throw new Error(`Bulk catalog decisions are limited to ${limit} entities`);
  }
  if (new Set(entityIds).size !== entityIds.length) {
    throw new Error('Bulk catalog decision cannot include duplicate entity ids');
  }
  return entityIds;
}

async function recordCatalogDecision(input: {
  readonly entityId: string;
  readonly action: CatalogDecisionAction;
  readonly reason: string;
  readonly actorUid: string;
  readonly actorEmail: string;
}): Promise<{ readonly record: CatalogDecisionRecord; readonly auditEventId: string }> {
  const now = new Date().toISOString();
  const path = ledgerPaths.catalogDecision(input.entityId);
  const record: CatalogDecisionRecord = {
    entityId: input.entityId,
    action: input.action,
    reason: input.reason,
    decidedByUid: input.actorUid,
    decidedByEmail: input.actorEmail,
    decidedAt: now,
  };

  const auditAction = auditActionFor(input.action);
  const idempotencyKey = `catalog-decision:${input.entityId}:${input.action}:${now}:${randomUUID()}`;
  const eventId = randomUUID();
  const auditEvent = {
    id: eventId,
    action: auditAction,
    category: auditCategoryFor(auditAction),
    actor: { type: 'user' as const, id: input.actorUid, displayName: input.actorEmail },
    subject: { type: 'canonicalEntity', id: input.entityId, path },
    reason: input.reason,
    requestId: randomUUID(),
    correlationId: idempotencyKey,
    idempotencyKey,
    occurredAt: now,
    entityId: input.entityId,
    data: { decision: input.action },
  };

  const outboxMessage = {
    id: randomUUID(),
    eventId,
    topic: 'catalog.decision.recorded',
    aggregateType: 'canonicalEntity',
    aggregateId: input.entityId,
    payload: { entityId: input.entityId, decision: input.action },
    status: 'pending' as const,
    attempts: 0,
    maxAttempts: 8,
    availableAt: now,
    createdAt: now,
    correlationId: idempotencyKey,
    idempotencyKey,
  };

  const result = await commitWithAuditPostgres({
    auditEvent,
    outboxMessage,
    applyState: async (client) => {
      await writeCatalogDecisionPostgres(client, { record });
    },
  });
  return { record, auditEventId: result.eventId };
}

export async function bulkRecordCatalogDecisions(input: {
  readonly entityIds: readonly string[];
  readonly action: CatalogDecisionAction;
  readonly reason: string;
  readonly actorUid: string;
  readonly actorEmail: string;
}): Promise<{
  readonly succeeded: number;
  readonly failed: number;
  readonly errors: readonly { readonly entityId: string; readonly error: string }[];
}> {
  const entityIds = assertCatalogBulkSelection(input.entityIds);

  let succeeded = 0;
  let failed = 0;
  const errors: { entityId: string; error: string }[] = [];

  for (const entityId of entityIds) {
    try {
      await recordCatalogDecision({
        entityId,
        action: input.action,
        reason: input.reason,
        actorUid: input.actorUid,
        actorEmail: input.actorEmail,
      });
      succeeded += 1;
    } catch (error) {
      failed += 1;
      errors.push({ entityId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { succeeded, failed, errors };
}

/** Latest decision per requested entity id, for the catalog list to show a status badge. */
export async function listCatalogDecisions(
  entityIds: readonly string[],
): Promise<ReadonlyMap<string, CatalogDecisionRecord>> {
  if (entityIds.length === 0) return new Map();
  return listCatalogDecisionsPostgres(entityIds);
}
