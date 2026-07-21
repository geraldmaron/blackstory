/**
 * Postgres transaction helper for canonical audit/outbox semantics:
 * idempotent on key, atomically writes domain state + audit event + outbox + idempotency marker.
 */
import type pg from 'pg';
import type { DomainAuditEvent, DomainOutboxMessage } from '@repo/domain';
import { withPostgresTransaction } from './postgres-client.js';

export type PostgresCommitResult = {
  readonly committed: boolean;
  readonly replayed: boolean;
  readonly eventId: string;
  readonly outboxMessageId: string;
};

export type PostgresCommitInput = {
  readonly auditEvent: DomainAuditEvent;
  readonly outboxMessage: DomainOutboxMessage;
  readonly applyState: (client: pg.PoolClient) => Promise<void>;
};

type IdempotencyRow = {
  readonly event_id: string | null;
  readonly outbox_message_id: string | null;
};

function assertOutboxMatchesAudit(auditEvent: DomainAuditEvent, outboxMessage: DomainOutboxMessage): void {
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
}

/** Atomically commits state, audit, outbox, and idempotency record; replays on duplicate key. */
export async function commitWithAuditPostgres(
  input: PostgresCommitInput,
): Promise<PostgresCommitResult> {
  const { auditEvent, outboxMessage } = input;
  assertOutboxMatchesAudit(auditEvent, outboxMessage);

  return withPostgresTransaction(async (client) => {
    const existing = await client.query<IdempotencyRow>(
      `SELECT event_id, outbox_message_id
       FROM bb_ops.idempotency_keys
       WHERE key = $1`,
      [auditEvent.idempotencyKey],
    );
    if (existing.rowCount && existing.rows[0]) {
      const row = existing.rows[0];
      return {
        committed: false,
        replayed: true,
        eventId: row.event_id ?? auditEvent.id,
        outboxMessageId: row.outbox_message_id ?? outboxMessage.id,
      };
    }

    await input.applyState(client);

    await client.query(
      `INSERT INTO bb_audit.events
        (id, action, category, actor, subject, reason, request_id, correlation_id,
         release_id, entity_id, idempotency_key, occurred_at, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        auditEvent.id,
        auditEvent.action,
        auditEvent.category,
        JSON.stringify(auditEvent.actor),
        JSON.stringify(auditEvent.subject),
        auditEvent.reason,
        auditEvent.requestId,
        auditEvent.correlationId,
        auditEvent.releaseId ?? null,
        auditEvent.entityId ?? null,
        auditEvent.idempotencyKey,
        auditEvent.occurredAt,
        JSON.stringify(auditEvent.data ?? {}),
      ],
    );

    await client.query(
      `INSERT INTO bb_ops.outbox_messages
        (id, event_id, topic, aggregate_type, aggregate_id, payload, status, attempts,
         max_attempts, available_at, created_at, correlation_id, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        outboxMessage.id,
        outboxMessage.eventId,
        outboxMessage.topic,
        outboxMessage.aggregateType,
        outboxMessage.aggregateId,
        JSON.stringify(outboxMessage.payload ?? {}),
        outboxMessage.status,
        outboxMessage.attempts,
        outboxMessage.maxAttempts,
        outboxMessage.availableAt,
        outboxMessage.createdAt,
        outboxMessage.correlationId,
        outboxMessage.idempotencyKey,
      ],
    );

    await client.query(
      `INSERT INTO bb_ops.idempotency_keys
        (key, event_id, outbox_message_id, correlation_id, created_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        auditEvent.idempotencyKey,
        auditEvent.id,
        outboxMessage.id,
        auditEvent.correlationId,
        auditEvent.occurredAt,
      ],
    );

    return {
      committed: true,
      replayed: false,
      eventId: auditEvent.id,
      outboxMessageId: outboxMessage.id,
    };
  });
}
