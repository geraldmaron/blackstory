/**
 * Verifies operator identity stamping and its guardrails.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertOperatorIdentity, buildOperatorActor, operatorStamp } from './identity.ts';

const IDENTITY = {
  operatorId: 'operator-gerald',
  sessionId: 'session-2026-07-17-01',
  source: 'claude_session' as const,
  displayName: 'Gerald (owner session)',
};

test('builds a user-type audit actor from an operator identity', () => {
  const actor = buildOperatorActor(IDENTITY);
  assert.equal(actor.id, 'operator-gerald');
  assert.equal(actor.type, 'user');
  assert.equal(actor.displayName, 'Gerald (owner session)');
});

test('operator actor is never a system actor, even implicitly', () => {
  const actor = buildOperatorActor({ ...IDENTITY, source: 'cli' });
  assert.notEqual(actor.type, 'system');
});

test('stamp carries operatorId, sessionId, and source only', () => {
  const stamp = operatorStamp(IDENTITY);
  assert.deepEqual(stamp, {
    operatorId: 'operator-gerald',
    sessionId: 'session-2026-07-17-01',
    source: 'claude_session',
  });
});

test('rejects a missing operatorId, sessionId, or unknown source', () => {
  assert.throws(() => assertOperatorIdentity({ ...IDENTITY, operatorId: '  ' }), /operatorId/);
  assert.throws(() => assertOperatorIdentity({ ...IDENTITY, sessionId: '' }), /sessionId/);
  assert.throws(
    // @ts-expect-error intentionally invalid source
    () => assertOperatorIdentity({ ...IDENTITY, source: 'automation' }),
    /Unknown operator source/,
  );
});
