/**
 * Atomic Firestore promotion to publication candidacy with audit, outbox, and idempotency.
 */
import type { AtomicStore } from './audit-outbox.js';
import {
  auditEventSchema,
  idempotencyRecordSchema,
  outboxMessageSchema,
  type AuditEventDoc,
  type IdempotencyRecordDoc,
  type OutboxMessageDoc,
} from './types.js';

export type AcceptedPromotionDoc = {
  readonly id: string;
  readonly stage: 'accepted_claim' | 'publication_candidate';
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly proposerId: string;
  readonly approverId: string;
  readonly updatedAt: string;
  readonly releaseCandidateId?: string;
};

export type PublicationCandidateDoc = {
  readonly id: string;
  readonly promotionId: string;
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly policyVersion: string;
  readonly independentLineageCount: number;
  readonly confidenceThreshold: number;
  readonly preview: {
    readonly added: number;
    readonly changed: number;
    readonly removed: number;
    readonly unchanged: number;
  };
  readonly createdAt: string;
  readonly createdBy: string;
};

export type PromoteClaimInput = {
  readonly promotionId: string;
  readonly candidate: PublicationCandidateDoc;
  readonly gate: {
    readonly approved: boolean;
    readonly deterministic: true;
    readonly policyVersion: string;
    readonly reasons: readonly string[];
    readonly independentLineageCount: number;
    readonly confidenceThreshold: number;
  };
  readonly now: string;
  readonly auditEvent: AuditEventDoc;
  readonly outboxMessage: OutboxMessageDoc;
};

export type PromoteClaimResult = {
  readonly committed: boolean;
  readonly replayed: boolean;
  readonly promotionId: string;
  readonly releaseCandidateId: string;
};

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/;

function safePath(root: string, id: string): string {
  if (!SAFE_ID_PATTERN.test(id)) throw new Error(`${root} id is not safe`);
  return `${root}/${id}`;
}

function idempotencyPath(key: string): string {
  return `idempotencyKeys/${Buffer.from(key, 'utf8').toString('base64url')}`;
}

function parseAcceptedPromotion(value: unknown): AcceptedPromotionDoc {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Promotion record must be an object');
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (
    typeof record.id !== 'string' ||
    (record.stage !== 'accepted_claim' && record.stage !== 'publication_candidate') ||
    typeof record.claimId !== 'string' ||
    typeof record.claimVersionId !== 'string' ||
    typeof record.proposerId !== 'string' ||
    typeof record.approverId !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    throw new Error('Promotion record is invalid');
  }
  return value as AcceptedPromotionDoc;
}

function assertPromotionEnvelope(
  input: PromoteClaimInput,
  auditEvent: AuditEventDoc,
  outboxMessage: OutboxMessageDoc,
): void {
  if (!input.gate.deterministic || !input.gate.approved || input.gate.reasons.length > 0) {
    throw new Error('Publication candidacy requires an approved deterministic gate');
  }
  if (
    input.candidate.id !== outboxMessage.aggregateId ||
    input.candidate.id !== outboxMessage.payload.releaseCandidateId ||
    input.candidate.promotionId !== input.promotionId ||
    input.candidate.policyVersion !== input.gate.policyVersion ||
    input.candidate.independentLineageCount !== input.gate.independentLineageCount ||
    input.candidate.confidenceThreshold !== input.gate.confidenceThreshold
  ) {
    throw new Error('Publication candidate must match the deterministic gate and outbox payload');
  }
  if (
    input.candidate.createdAt !== input.now ||
    !input.candidate.createdBy.trim() ||
    !Number.isInteger(input.candidate.independentLineageCount) ||
    input.candidate.independentLineageCount < 1 ||
    !Number.isFinite(input.candidate.confidenceThreshold) ||
    input.candidate.confidenceThreshold < 0 ||
    input.candidate.confidenceThreshold > 1 ||
    Object.values(input.candidate.preview).some((count) => !Number.isInteger(count) || count < 0)
  ) {
    throw new Error('Publication candidate metadata is invalid');
  }
  if (
    auditEvent.action !== 'moderation.approved' ||
    auditEvent.subject.type !== 'claimPromotion' ||
    auditEvent.subject.id !== input.promotionId ||
    auditEvent.actor.id !== input.candidate.createdBy
  ) {
    throw new Error('Promotion audit event must identify the approval and approver');
  }
  if (
    outboxMessage.eventId !== auditEvent.id ||
    outboxMessage.idempotencyKey !== auditEvent.idempotencyKey ||
    outboxMessage.correlationId !== auditEvent.correlationId ||
    outboxMessage.aggregateType !== 'publicationCandidate' ||
    outboxMessage.status !== 'pending' ||
    outboxMessage.attempts !== 0
  ) {
    throw new Error('Promotion outbox message must match its audit event and start pending');
  }
}

export async function promoteClaimToPublicationCandidate(
  store: AtomicStore,
  input: PromoteClaimInput,
): Promise<PromoteClaimResult> {
  if (!Number.isFinite(Date.parse(input.now)))
    throw new Error('now must be an ISO-compatible date');
  const auditEvent = auditEventSchema.parse(input.auditEvent);
  const outboxMessage = outboxMessageSchema.parse(input.outboxMessage);
  assertPromotionEnvelope(input, auditEvent, outboxMessage);
  const promotionPath = safePath('claimPromotions', input.promotionId);
  const candidatePath = safePath('publicationCandidates', input.candidate.id);

  return store.runTransaction(async (transaction) => {
    const markerPath = idempotencyPath(auditEvent.idempotencyKey);
    const markerSnapshot = await transaction.get(markerPath);
    if (markerSnapshot.exists) {
      const marker = idempotencyRecordSchema.parse(markerSnapshot.data());
      if (
        marker.eventId !== auditEvent.id ||
        marker.outboxMessageId !== outboxMessage.id ||
        marker.correlationId !== auditEvent.correlationId
      ) {
        throw new Error('Idempotency key belongs to a different promotion operation');
      }
      return {
        committed: false,
        replayed: true,
        promotionId: input.promotionId,
        releaseCandidateId: input.candidate.id,
      };
    }

    const promotionSnapshot = await transaction.get(promotionPath);
    if (!promotionSnapshot.exists)
      throw new Error(`Promotion does not exist: ${input.promotionId}`);
    const promotion = parseAcceptedPromotion(promotionSnapshot.data());
    if (promotion.stage !== 'accepted_claim') {
      throw new Error(`Promotion stage ${promotion.stage} cannot become a publication candidate`);
    }
    if (
      promotion.id !== input.promotionId ||
      promotion.claimId !== input.candidate.claimId ||
      promotion.claimVersionId !== input.candidate.claimVersionId
    ) {
      throw new Error('Publication candidate claim must match the accepted promotion');
    }
    if (
      promotion.proposerId === promotion.approverId ||
      promotion.approverId !== input.candidate.createdBy
    ) {
      throw new Error('Promotion requires a separate recorded approver');
    }

    transaction.update(promotionPath, {
      stage: 'publication_candidate',
      releaseCandidateId: input.candidate.id,
      updatedAt: input.now,
    });
    transaction.create(candidatePath, input.candidate);
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
      promotionId: input.promotionId,
      releaseCandidateId: input.candidate.id,
    };
  });
}
