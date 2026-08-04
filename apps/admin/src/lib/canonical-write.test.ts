/**
 * Proves the canonical write path is role-gated and cannot commit state without an audit event.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type pg from 'pg';
import type { ServerAdminIdentity } from '../auth/supabase-server';
import {
  commitCanonicalWrite,
  permissionForCanonicalVerb,
  type CanonicalWriteDependencies,
  type CanonicalWriteRequest,
} from './canonical-write';
import type { PostgresCommitInput } from './postgres-commit';

function identity(role: ServerAdminIdentity['role']): ServerAdminIdentity {
  return { uid: 'user-1', email: 'staff@example.com', role };
}

function fixture(who: ServerAdminIdentity | null) {
  const commits: PostgresCommitInput[] = [];
  let counter = 0;
  const dependencies: CanonicalWriteDependencies = {
    readIdentity: async () => who,
    async commit(input) {
      commits.push(input);
      // The helper writes state only inside the audited transaction, so exercising applyState
      // here is what proves state and audit share one commit.
      await input.applyState({} as pg.PoolClient);
      return { eventId: input.auditEvent.id, replayed: false };
    },
    newId: () => `id-${++counter}`,
    now: () => '2026-08-04T00:00:00.000Z',
  };
  return { commits, dependencies };
}

function request(overrides: Partial<CanonicalWriteRequest> = {}): CanonicalWriteRequest {
  return {
    verb: 'entity.field_edit',
    subjectId: 'entity-1',
    reason: 'Corrected the display name against the source.',
    applyState: async () => {},
    ...overrides,
  };
}

test('a role without the verb permission is refused and nothing is committed', async () => {
  const { commits, dependencies } = fixture(identity('publication'));

  const result = await commitCanonicalWrite(request(), dependencies);

  assert.equal(result.status, 'forbidden');
  assert.equal(result.status === 'forbidden' && result.permission, 'canonical:write');
  assert.equal(commits.length, 0);
});

test('research may edit a field but may not merge or bulk reassign', async () => {
  const edit = fixture(identity('research'));
  assert.equal((await commitCanonicalWrite(request(), edit.dependencies)).status, 'ok');

  const merge = fixture(identity('research'));
  const mergeResult = await commitCanonicalWrite(
    request({ verb: 'entity.merge' }),
    merge.dependencies,
  );
  assert.equal(mergeResult.status, 'forbidden');
  assert.equal(merge.commits.length, 0);

  const bulk = fixture(identity('research'));
  const bulkResult = await commitCanonicalWrite(
    request({ verb: 'entity.bulk_kind_reassign' }),
    bulk.dependencies,
  );
  assert.equal(bulkResult.status, 'forbidden');
  assert.equal(bulk.commits.length, 0);
});

test('admin may run every canonical verb', async () => {
  for (const verb of ['entity.field_edit', 'entity.merge', 'entity.bulk_kind_reassign'] as const) {
    const { commits, dependencies } = fixture(identity('admin'));
    const result = await commitCanonicalWrite(request({ verb }), dependencies);
    assert.equal(result.status, 'ok', `${verb} should be allowed for admin`);
    assert.equal(commits[0]?.auditEvent.data?.verb, verb);
    assert.equal(commits[0]?.auditEvent.data?.permission, permissionForCanonicalVerb(verb));
  }
});

test('an unauthenticated caller cannot write even with a valid request', async () => {
  const { commits, dependencies } = fixture(null);

  const result = await commitCanonicalWrite(request(), dependencies);

  assert.equal(result.status, 'unauthenticated');
  assert.equal(commits.length, 0);
});

test('the audit actor comes from the verified session, never from the request', async () => {
  const { commits, dependencies } = fixture(identity('admin'));

  await commitCanonicalWrite(
    request({ data: { actor: { id: 'spoofed', type: 'user' }, before: 'a', after: 'b' } }),
    dependencies,
  );

  const event = commits[0]?.auditEvent;
  assert.deepEqual(event?.actor, {
    id: 'user-1',
    type: 'user',
    displayName: 'staff@example.com',
  });
  assert.equal(event?.data?.actorRole, 'admin');
  assert.equal(event?.data?.before, 'a');
});

test('a write with no reason is rejected before any identity or state work', async () => {
  const { commits, dependencies } = fixture(identity('admin'));

  const result = await commitCanonicalWrite(request({ reason: '   ' }), dependencies);

  assert.equal(result.status, 'invalid');
  assert.equal(commits.length, 0);
});

test('a write with no subject id is rejected', async () => {
  const { commits, dependencies } = fixture(identity('admin'));

  const result = await commitCanonicalWrite(request({ subjectId: ' ' }), dependencies);

  assert.equal(result.status, 'invalid');
  assert.equal(commits.length, 0);
});

test('audit event, outbox message, and idempotency key are consistent', async () => {
  const { commits, dependencies } = fixture(identity('admin'));

  await commitCanonicalWrite(
    request({ verb: 'entity.bulk_kind_reassign', affectedCount: 42, idempotencyKey: 'batch-7' }),
    dependencies,
  );

  const [commit] = commits;
  assert.ok(commit);
  assert.equal(commit.outboxMessage.eventId, commit.auditEvent.id);
  assert.equal(commit.outboxMessage.idempotencyKey, 'batch-7');
  assert.equal(commit.auditEvent.idempotencyKey, 'batch-7');
  assert.equal(commit.outboxMessage.correlationId, commit.auditEvent.correlationId);
  assert.equal(commit.outboxMessage.status, 'pending');
  assert.equal(commit.outboxMessage.attempts, 0);
  assert.equal(commit.auditEvent.data?.affectedCount, 42);
  assert.equal(commit.auditEvent.entityId, 'entity-1');
});

test('a failing transaction reports failure rather than throwing into the render', async () => {
  const { dependencies } = fixture(identity('admin'));
  const result = await commitCanonicalWrite(request(), {
    ...dependencies,
    commit: async () => {
      throw new Error('deadlock detected');
    },
  });

  assert.equal(result.status, 'failed');
  assert.match(result.status === 'failed' ? result.message : '', /deadlock/);
});
