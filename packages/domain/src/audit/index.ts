/**
 * Append-only audit contracts and publication-history reconstruction for BB-018.
 * These framework-independent types are shared by Firestore writers, consumers, and future APIs.
 */
export const AUDIT_EVENT_ACTIONS = [
  'policy.changed',
  'source.registered',
  'source.updated',
  'source.enabled',
  'source.disabled',
  'research.created',
  'research.updated',
  'research.completed',
  'moderation.approved',
  'moderation.rejected',
  'moderation.escalated',
  'publication.published',
  'publication.release_activated',
  'publication.release_retired',
  'correction.requested',
  'correction.applied',
  'retraction.retracted',
  'retraction.reversed',
  'authentication.signed_in',
  'authentication.failed',
  'authentication.signed_out',
  'authentication.mfa_changed',
  'administrative.role_changed',
  'administrative.configuration_changed',
  'administrative.exported',
] as const;

export type AuditEventAction = (typeof AUDIT_EVENT_ACTIONS)[number];
export type AuditEventCategory = AuditEventAction extends `${infer Category}.${string}`
  ? Category
  : never;

export const ACTOR_TYPES = ['user', 'service', 'system'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export type AuditActor = {
  readonly id: string;
  readonly type: ActorType;
  readonly displayName?: string | undefined;
};

export type AuditSubject = {
  readonly type: string;
  readonly id: string;
  readonly path: string;
};

export type DomainAuditEvent = {
  readonly id: string;
  readonly action: AuditEventAction;
  readonly category: AuditEventCategory;
  readonly actor: AuditActor;
  readonly subject: AuditSubject;
  readonly reason: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly releaseId?: string | undefined;
  readonly entityId?: string | undefined;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly data?: Readonly<Record<string, unknown>> | undefined;
};

export const OUTBOX_STATUSES = ['pending', 'processed', 'dead_letter'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export type DomainOutboxMessage = {
  readonly id: string;
  readonly eventId: string;
  readonly topic: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly availableAt: string;
  readonly createdAt: string;
  readonly processedAt?: string | undefined;
  readonly lastError?: string | undefined;
  readonly correlationId: string;
  readonly idempotencyKey: string;
};

export type PublicationHistoryEntry = {
  readonly eventId: string;
  readonly action: Extract<
    AuditEventAction,
    `publication.${string}` | `correction.${string}` | `retraction.${string}`
  >;
  readonly occurredAt: string;
  readonly actor: AuditActor;
  readonly reason: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly releaseId?: string | undefined;
  readonly data?: Readonly<Record<string, unknown>> | undefined;
};

const PUBLICATION_HISTORY_CATEGORIES = new Set<AuditEventCategory>([
  'publication',
  'correction',
  'retraction',
]);

export function auditCategoryFor(action: AuditEventAction): AuditEventCategory {
  return action.slice(0, action.indexOf('.')) as AuditEventCategory;
}

export function isPublicationHistoryEvent(
  event: DomainAuditEvent,
): event is DomainAuditEvent & { action: PublicationHistoryEntry['action'] } {
  return event.entityId !== undefined && PUBLICATION_HISTORY_CATEGORIES.has(event.category);
}

/**
 * Reconstruct an entity's immutable publication timeline. Event id is the stable tie-breaker
 * when two writes share the same timestamp.
 */
export function reconstructPublicationHistory(
  entityId: string,
  events: readonly DomainAuditEvent[],
): readonly PublicationHistoryEntry[] {
  return events
    .filter(isPublicationHistoryEvent)
    .filter((event) => event.entityId === entityId)
    .sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id),
    )
    .map((event) => ({
      eventId: event.id,
      action: event.action,
      occurredAt: event.occurredAt,
      actor: event.actor,
      reason: event.reason,
      requestId: event.requestId,
      correlationId: event.correlationId,
      ...(event.releaseId ? { releaseId: event.releaseId } : {}),
      ...(event.data ? { data: event.data } : {}),
    }));
}
