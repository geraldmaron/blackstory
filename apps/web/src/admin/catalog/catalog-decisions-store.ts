/**
 * Bulk admin decisions on published catalog entities (flag for retraction, needs review,
 * clear). Records audited DECISIONS only — this never mutates the entity or a release directly.
 * Writes only to Postgres (bb_ops.catalog_decisions).
 *
 * The whole selection commits with one INSERT ... SELECT over `unnest($1::text[])` inside one
 * audited transaction, the same set-based shape as the canonical bulk field edit in
 * entity-bulk-edit.ts / bulk-actions.ts: 5 ids and 5,000 ids cost the same round trip, and either
 * all of them land or none do. There is one audit event and one outbox message for the whole
 * batch — the set is the subject, and the ids it covers live in the event's `data`.
 */
import { randomUUID } from 'node:crypto';
import { auditCategoryFor } from '@repo/domain';
import { commitWithAuditPostgres, type PostgresCommitInput } from '@/admin/lib/postgres-commit';
import {
  listCatalogDecisionsPostgres,
  writeCatalogDecisionsBulkPostgres,
} from '@/admin/lib/postgres-catalog';

/**
 * The most entities one bulk decision may address. A set-based statement costs the same whether
 * it touches 5 rows or 10,000, so this now matches the ceiling on what an operator can select in
 * one go — `MAX_SELECTION` in the entity-ids select-all-matching route and `MAX_BULK_ENTITIES` in
 * entity-bulk-edit.ts — rather than a per-transaction budget.
 */
export const CATALOG_BULK_DECISION_LIMIT = 10_000;

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

/** Injectable seam so tests can fake the transaction instead of hitting Postgres. */
export type CatalogDecisionDependencies = {
  readonly commit: (
    input: PostgresCommitInput,
  ) => Promise<{ readonly eventId: string; readonly replayed: boolean }>;
  readonly newId: () => string;
  readonly now: () => string;
};

const defaultDependencies: CatalogDecisionDependencies = {
  commit: commitWithAuditPostgres,
  newId: () => randomUUID(),
  now: () => new Date().toISOString(),
};

export async function bulkRecordCatalogDecisions(
  input: {
    readonly entityIds: readonly string[];
    readonly action: CatalogDecisionAction;
    readonly reason: string;
    readonly actorUid: string;
    readonly actorEmail: string;
  },
  dependencies: Partial<CatalogDecisionDependencies> = {},
): Promise<{
  readonly succeeded: number;
  readonly failed: number;
  readonly errors: readonly { readonly entityId: string; readonly error: string }[];
}> {
  const entityIds = assertCatalogBulkSelection(input.entityIds);
  const deps = { ...defaultDependencies, ...dependencies };

  const now = deps.now();
  const auditAction = auditActionFor(input.action);
  const eventId = deps.newId();
  const idempotencyKey = `catalog-decision-bulk:${input.action}:${now}:${eventId}`;
  // Synthetic subject id for the set — there is no single entity a bulk decision is "about".
  const subjectId = `catalogDecisions:${input.action}:${eventId}`;

  const auditEvent = {
    id: eventId,
    action: auditAction,
    category: auditCategoryFor(auditAction),
    actor: { type: 'user' as const, id: input.actorUid, displayName: input.actorEmail },
    // The set is the subject; the ids it covers live in `data` rather than one of them standing
    // in for the rest, so a reader of the audit log sees exactly which entities were decided.
    subject: {
      type: 'canonicalEntitySet',
      id: subjectId,
      path: `catalogDecisions?bulk=${eventId}`,
    },
    reason: input.reason,
    requestId: deps.newId(),
    correlationId: idempotencyKey,
    idempotencyKey,
    occurredAt: now,
    data: { decision: input.action, entityIds, affectedCount: entityIds.length },
  };

  const outboxMessage = {
    id: deps.newId(),
    eventId,
    topic: 'catalog.decision.recorded',
    aggregateType: 'canonicalEntitySet',
    aggregateId: subjectId,
    payload: { entityIds, decision: input.action },
    status: 'pending' as const,
    attempts: 0,
    maxAttempts: 8,
    availableAt: now,
    createdAt: now,
    correlationId: idempotencyKey,
    idempotencyKey,
  };

  try {
    await deps.commit({
      auditEvent,
      outboxMessage,
      applyState: async (client) => {
        await writeCatalogDecisionsBulkPostgres(client, {
          entityIds,
          action: input.action,
          reason: input.reason,
          actorUid: input.actorUid,
          actorEmail: input.actorEmail,
          decidedAt: now,
        });
      },
    });
    return { succeeded: entityIds.length, failed: 0, errors: [] };
  } catch (error) {
    // One transaction for the whole set: a failure here rolled back every row and the audit
    // event together, so there is no partial count to report — every id in the selection failed
    // for the same reason.
    const message = error instanceof Error ? error.message : String(error);
    return {
      succeeded: 0,
      failed: entityIds.length,
      errors: entityIds.map((entityId) => ({ entityId, error: message })),
    };
  }
}

/** Latest decision per requested entity id, for the catalog list to show a status badge. */
export async function listCatalogDecisions(
  entityIds: readonly string[],
): Promise<ReadonlyMap<string, CatalogDecisionRecord>> {
  if (entityIds.length === 0) return new Map();
  return listCatalogDecisionsPostgres(entityIds);
}
