/**
 * Unit tests for audit categories and deterministic publication-history reconstruction.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  auditCategoryFor,
  reconstructPublicationHistory,
  type DomainAuditEvent,
} from './audit/index.js';

const actor = { id: 'publisher-1', type: 'user' as const };

function event(
  overrides: Partial<DomainAuditEvent> & Pick<DomainAuditEvent, 'id' | 'action' | 'occurredAt'>,
): DomainAuditEvent {
  return {
    category: auditCategoryFor(overrides.action),
    actor,
    subject: { type: 'entity', id: 'entity-1', path: 'canonicalEntities/entity-1' },
    reason: 'Editorial decision',
    requestId: `request-${overrides.id}`,
    correlationId: 'correlation-1',
    entityId: 'entity-1',
    idempotencyKey: `key-${overrides.id}`,
    ...overrides,
  };
}

test('audit category is derived from the controlled action vocabulary', () => {
  assert.equal(auditCategoryFor('authentication.failed'), 'authentication');
  assert.equal(auditCategoryFor('retraction.retracted'), 'retraction');
});

test('publication history is complete, scoped, and deterministic', () => {
  const events = [
    event({
      id: 'event-3',
      action: 'retraction.retracted',
      occurredAt: '2026-07-16T20:00:00.000Z',
      releaseId: 'release-3',
    }),
    event({
      id: 'event-2',
      action: 'correction.applied',
      occurredAt: '2026-07-16T19:00:00.000Z',
      releaseId: 'release-2',
    }),
    event({
      id: 'event-1',
      action: 'publication.published',
      occurredAt: '2026-07-16T18:00:00.000Z',
      releaseId: 'release-1',
    }),
    event({
      id: 'event-research',
      action: 'research.updated',
      occurredAt: '2026-07-16T17:00:00.000Z',
    }),
    event({
      id: 'event-other',
      action: 'publication.published',
      occurredAt: '2026-07-16T16:00:00.000Z',
      entityId: 'entity-2',
    }),
  ];

  const history = reconstructPublicationHistory('entity-1', events);
  assert.deepEqual(
    history.map(({ action, releaseId }) => [action, releaseId]),
    [
      ['publication.published', 'release-1'],
      ['correction.applied', 'release-2'],
      ['retraction.retracted', 'release-3'],
    ],
  );
});
