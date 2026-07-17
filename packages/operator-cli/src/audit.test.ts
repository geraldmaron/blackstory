/**
 * Verifies operator-stamped BB-018 audit events and paired outbox messages.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildOperatorAuditEvent, buildOperatorOutboxMessage } from './audit.ts';

const IDENTITY = {
  operatorId: 'operator-gerald',
  sessionId: 'session-01',
  source: 'cli' as const,
};

const NOW = '2026-07-17T04:00:00.000Z';

test('audit event category is derived from the action, actor is the operator', () => {
  const event = buildOperatorAuditEvent({
    action: 'research.created',
    subject: { type: 'submissionInbox', id: 'sub-1', path: 'submissionInbox/sub-1' },
    identity: IDENTITY,
    reason: 'Operator proposed a lead.',
    now: NOW,
    idempotencyKey: 'idem-1',
  });
  assert.equal(event.category, 'research');
  assert.equal(event.actor.id, 'operator-gerald');
  assert.equal(event.actor.type, 'user');
  assert.equal(event.correlationId, 'idem-1');
  assert.ok(event.id);
  assert.ok(event.requestId);
});

test('outbox message pairs to the audit event id, idempotency key, and correlation id', () => {
  const event = buildOperatorAuditEvent({
    action: 'source.registered',
    subject: { type: 'submissionInbox', id: 'sub-2', path: 'submissionInbox/sub-2' },
    identity: IDENTITY,
    reason: 'Operator proposed a source.',
    now: NOW,
    idempotencyKey: 'idem-2',
  });
  const message = buildOperatorOutboxMessage({
    auditEvent: event,
    topic: 'operator.submission.created',
    aggregateType: 'submissionInbox',
    aggregateId: 'sub-2',
    payload: { kind: 'contribution' },
    now: NOW,
  });
  assert.equal(message.eventId, event.id);
  assert.equal(message.correlationId, event.correlationId);
  assert.equal(message.idempotencyKey, event.idempotencyKey);
  assert.equal(message.status, 'pending');
  assert.equal(message.attempts, 0);
});
