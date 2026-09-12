import assert from 'node:assert/strict';
import { test } from 'node:test';
import type pg from 'pg';
import {
  assertCatalogBulkSelection,
  bulkRecordCatalogDecisions,
  CATALOG_BULK_DECISION_LIMIT,
  CATALOG_DECISION_ACTIONS,
  type CatalogDecisionDependencies,
} from './catalog-decisions-store';
import type { PostgresCommitInput } from '@/admin/lib/postgres-commit';

test('bulk catalog selection enforces non-empty unique capped ids', () => {
  assert.deepEqual(assertCatalogBulkSelection(['ent_a', 'ent_b']), ['ent_a', 'ent_b']);
  assert.throws(() => assertCatalogBulkSelection([]), /at least one/);
  assert.throws(() => assertCatalogBulkSelection(['ent_a', 'ent_a']), /duplicate/);
  assert.throws(
    () =>
      assertCatalogBulkSelection(
        Array.from({ length: 6 }, (_, i) => `ent_${i}`),
        5,
      ),
    /limited to 5/,
  );
});

test('the default cap matches what select-all-matching can produce, not a per-transaction budget', () => {
  // 10,000 mirrors MAX_SELECTION in the entity-ids route and MAX_BULK_ENTITIES in
  // entity-bulk-edit.ts: a set-based statement costs the same at any of these sizes.
  assert.equal(CATALOG_BULK_DECISION_LIMIT, 10_000);
});

test('catalog decision actions are exactly flag/needs-review/clear', () => {
  assert.deepEqual([...CATALOG_DECISION_ACTIONS].sort(), [
    'clear_flag',
    'flag_for_retraction',
    'needs_review',
  ]);
});

/**
 * Fakes the transaction the same way canonical-write.test.ts does: `commit` is injected instead
 * of reaching Postgres, and it runs `applyState` against a fake client that records every query
 * it receives. That is what lets these tests prove the write is one statement covering the whole
 * set, not one transaction looped per entity.
 */
function fixture() {
  const commits: PostgresCommitInput[] = [];
  const queries: { readonly sql: string; readonly params: readonly unknown[] }[] = [];
  let counter = 0;

  const client = {
    query: async (sql: string, params?: readonly unknown[]) => {
      const ids = (params?.[0] as readonly string[] | undefined) ?? [];
      queries.push({ sql, params: params ?? [] });
      return { rows: ids.map((id) => ({ entity_id: id })), rowCount: ids.length };
    },
  } as unknown as pg.PoolClient;

  const dependencies: Partial<CatalogDecisionDependencies> = {
    async commit(input) {
      commits.push(input);
      await input.applyState(client);
      return { eventId: input.auditEvent.id, replayed: false };
    },
    newId: () => `id-${++counter}`,
    now: () => '2026-08-04T00:00:00.000Z',
  };

  return { commits, queries, dependencies };
}

function request(entityIds: readonly string[]) {
  return {
    entityIds,
    action: 'flag_for_retraction' as const,
    reason: 'Duplicate of a merged record.',
    actorUid: 'user-1',
    actorEmail: 'staff@example.com',
  };
}

test('a bulk decision on 3 entities commits one transaction with one set-based statement', async () => {
  const { commits, queries, dependencies } = fixture();

  const result = await bulkRecordCatalogDecisions(
    request(['ent_a', 'ent_b', 'ent_c']),
    dependencies,
  );

  assert.equal(result.succeeded, 3);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.errors, []);
  // One commit, one query inside it — not one per entity, which is what made the old path cap
  // out at 50.
  assert.equal(commits.length, 1);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0]?.params[0], ['ent_a', 'ent_b', 'ent_c']);
});

test('a failing commit fails every entity in the set — no partial success', async () => {
  const dependencies: Partial<CatalogDecisionDependencies> = {
    commit: async () => {
      throw new Error('deadlock detected');
    },
  };

  const result = await bulkRecordCatalogDecisions(request(['ent_a', 'ent_b']), dependencies);

  assert.equal(result.succeeded, 0);
  assert.equal(result.failed, 2);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.every((error) => /deadlock/.test(error.error)));
  assert.deepEqual(
    result.errors.map((error) => error.entityId),
    ['ent_a', 'ent_b'],
  );
});

test('the audit event and outbox message cover the whole set as one subject', async () => {
  const { commits, dependencies } = fixture();

  await bulkRecordCatalogDecisions(request(['ent_a', 'ent_b']), dependencies);

  const [commit] = commits;
  assert.ok(commit);
  assert.equal(commit.outboxMessage.eventId, commit.auditEvent.id);
  assert.equal(commit.outboxMessage.idempotencyKey, commit.auditEvent.idempotencyKey);
  assert.equal(commit.outboxMessage.correlationId, commit.auditEvent.correlationId);
  assert.equal(commit.outboxMessage.status, 'pending');
  assert.equal(commit.outboxMessage.attempts, 0);
  // A bulk decision has no single entity: the set is the subject, and entity_id stays unset.
  assert.equal(commit.auditEvent.subject.type, 'canonicalEntitySet');
  assert.equal(commit.auditEvent.entityId, undefined);
  assert.deepEqual(commit.auditEvent.data?.entityIds, ['ent_a', 'ent_b']);
  assert.equal(commit.auditEvent.data?.affectedCount, 2);
  assert.equal(commit.auditEvent.action, 'moderation.escalated');
  assert.equal(commit.auditEvent.category, 'moderation');
});

test('clearing a flag audits as moderation.approved', async () => {
  const { commits, dependencies } = fixture();

  await bulkRecordCatalogDecisions({ ...request(['ent_a']), action: 'clear_flag' }, dependencies);

  assert.equal(commits[0]?.auditEvent.action, 'moderation.approved');
});
