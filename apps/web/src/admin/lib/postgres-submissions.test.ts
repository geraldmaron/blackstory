/**
 * Proves the submissions decision path is role-gated, guards against double-processing, opens a
 * research case only on 'promote', and cannot commit state without an audit event.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type pg from 'pg';
import type { ServerAdminIdentity } from '../auth/supabase-server.js';
import type { PostgresCommitInput } from './postgres-commit.js';
import {
  commitSubmissionDecision,
  deriveSubmissionTitle,
  prepareSubmissionDecisionPlan,
  type SubmissionDecisionDependencies,
  type SubmissionDetail,
} from './postgres-submissions.js';

function identity(role: ServerAdminIdentity['role']): ServerAdminIdentity {
  return { uid: 'user-1', email: 'staff@example.com', role };
}

function submission(overrides: Partial<SubmissionDetail> = {}): SubmissionDetail {
  return {
    id: 'intake-1',
    status: 'quarantined',
    kind: 'lead',
    sourceUrl: 'https://example.org/lead',
    createdBy: 'submitter-uid',
    createdAt: '2026-07-20T00:00:00.000Z',
    title: 'Douglass Avenue mutual-aid office',
    payload: { title: 'Douglass Avenue mutual-aid office' },
    ...overrides,
  };
}

function fixture(who: ServerAdminIdentity | null, current: SubmissionDetail | null) {
  const commits: PostgresCommitInput[] = [];
  let counter = 0;
  const dependencies: SubmissionDecisionDependencies = {
    readIdentity: async () => who,
    readCurrent: async () => current,
    async commit(input) {
      commits.push(input);
      // The row exists and is still 'quarantined' (this fixture's `current`), so the guarded
      // UPDATE this simulates always finds one row — real double-processing is covered by the
      // dedicated race test below, which overrides `commit` itself.
      await input.applyState({ query: async () => ({ rowCount: 1 }) } as unknown as pg.PoolClient);
      return { eventId: input.auditEvent.id, replayed: false };
    },
    newId: () => `id-${++counter}`,
    now: () => '2026-08-04T00:00:00.000Z',
  };
  return { commits, dependencies };
}

test('deriveSubmissionTitle prefers the real nested payload.normalized.title', () => {
  const title = deriveSubmissionTitle(
    {
      normalized: { title: 'What Was Black Wall Street? History & Legacy', statement: 'ignored' },
      original: { payload: { title: 'ignored, normalized wins' } },
    },
    'intake-1',
  );
  assert.equal(title, 'What Was Black Wall Street? History & Legacy');
});

test('deriveSubmissionTitle reaches a story-packet draft title', () => {
  const title = deriveSubmissionTitle(
    { proposalKind: 'story_packet', storyPacket: { draft: { title: 'A staged packet' } } },
    'intake-1',
  );
  assert.equal(title, 'A staged packet');
});

test('deriveSubmissionTitle falls back to a labeled placeholder for an empty payload', () => {
  assert.equal(deriveSubmissionTitle({}, 'intake-1'), 'Untitled submission intake-1');
  assert.equal(deriveSubmissionTitle(null, 'intake-1'), 'Untitled submission intake-1');
});

test('prepareSubmissionDecisionPlan opens a research case only for promote', () => {
  const promotePlan = prepareSubmissionDecisionPlan({
    intakeItemId: 'intake-1',
    decision: 'promote',
    title: 'Douglass Avenue mutual-aid office',
    reason: 'Specific, sourceable subject.',
    identity: { uid: 'user-1', email: 'staff@example.com' },
    nowIso: '2026-08-04T00:00:00.000Z',
    newId: (() => {
      let n = 0;
      return () => `id-${++n}`;
    })(),
  });
  assert.equal(promotePlan.nextStatus, 'promoted');
  assert.ok(promotePlan.researchCaseId);
  assert.equal(promotePlan.auditEvent.action, 'moderation.approved');
  assert.equal(promotePlan.auditEvent.data.researchCaseId, promotePlan.researchCaseId);

  const rejectPlan = prepareSubmissionDecisionPlan({
    intakeItemId: 'intake-1',
    decision: 'reject',
    title: 'Douglass Avenue mutual-aid office',
    reason: 'Out of scope.',
    identity: { uid: 'user-1', email: 'staff@example.com' },
    nowIso: '2026-08-04T00:00:00.000Z',
    newId: (() => {
      let n = 0;
      return () => `id-${++n}`;
    })(),
  });
  assert.equal(rejectPlan.nextStatus, 'rejected');
  assert.equal(rejectPlan.researchCaseId, undefined);
  assert.equal(rejectPlan.auditEvent.action, 'moderation.rejected');

  const spamPlan = prepareSubmissionDecisionPlan({
    intakeItemId: 'intake-1',
    decision: 'spam',
    title: 'Douglass Avenue mutual-aid office',
    reason: 'Promotional content.',
    identity: { uid: 'user-1', email: 'staff@example.com' },
    nowIso: '2026-08-04T00:00:00.000Z',
    newId: (() => {
      let n = 0;
      return () => `id-${++n}`;
    })(),
  });
  assert.equal(spamPlan.nextStatus, 'spam');
  assert.equal(spamPlan.researchCaseId, undefined);
  assert.equal(spamPlan.auditEvent.action, 'moderation.rejected');
});

test('a role without research:write is refused and nothing is committed', async () => {
  const { commits, dependencies } = fixture(identity('publication'), submission());

  const result = await commitSubmissionDecision(
    { intakeItemId: 'intake-1', decision: 'promote', reason: 'Looks real.' },
    dependencies,
  );

  assert.equal(result.status, 'forbidden');
  assert.equal(commits.length, 0);
});

test('research and admin may decide submissions', async () => {
  for (const role of ['research', 'admin'] as const) {
    const { commits, dependencies } = fixture(identity(role), submission());
    const result = await commitSubmissionDecision(
      { intakeItemId: 'intake-1', decision: 'reject', reason: 'Out of scope.' },
      dependencies,
    );
    assert.equal(result.status, 'ok', `${role} should be allowed to decide`);
    assert.equal(commits.length, 1);
  }
});

test('an unauthenticated caller cannot decide even with a valid request', async () => {
  const { commits, dependencies } = fixture(null, submission());

  const result = await commitSubmissionDecision(
    { intakeItemId: 'intake-1', decision: 'reject', reason: 'Out of scope.' },
    dependencies,
  );

  assert.equal(result.status, 'unauthenticated');
  assert.equal(commits.length, 0);
});

test('a missing submission is reported before any write is attempted', async () => {
  const { commits, dependencies } = fixture(identity('admin'), null);

  const result = await commitSubmissionDecision(
    { intakeItemId: 'intake-1', decision: 'reject', reason: 'Out of scope.' },
    dependencies,
  );

  assert.equal(result.status, 'not_found');
  assert.equal(commits.length, 0);
});

test('a submission that already left quarantined is reported, not re-decided', async () => {
  const { commits, dependencies } = fixture(identity('admin'), submission({ status: 'promoted' }));

  const result = await commitSubmissionDecision(
    { intakeItemId: 'intake-1', decision: 'reject', reason: 'Out of scope.' },
    dependencies,
  );

  assert.equal(result.status, 'already_processed');
  assert.equal(commits.length, 0);
});

test('a decision with no reason is rejected before any identity or state work', async () => {
  const { commits, dependencies } = fixture(identity('admin'), submission());

  const result = await commitSubmissionDecision(
    { intakeItemId: 'intake-1', decision: 'reject', reason: '   ' },
    dependencies,
  );

  assert.equal(result.status, 'invalid');
  assert.equal(commits.length, 0);
});

test('an unknown decision value is rejected', async () => {
  const { commits, dependencies } = fixture(identity('admin'), submission());

  const result = await commitSubmissionDecision(
    // @ts-expect-error deliberately invalid at the boundary
    { intakeItemId: 'intake-1', decision: 'approve', reason: 'looks fine' },
    dependencies,
  );

  assert.equal(result.status, 'invalid');
  assert.equal(commits.length, 0);
});

test('promoting opens a research case and records it on the audit event', async () => {
  const { commits, dependencies } = fixture(identity('admin'), submission());

  const result = await commitSubmissionDecision(
    { intakeItemId: 'intake-1', decision: 'promote', reason: 'Specific, sourceable subject.' },
    dependencies,
  );

  assert.equal(result.status, 'ok');
  assert.ok(result.status === 'ok' && result.researchCaseId);
  const [commit] = commits;
  assert.ok(commit);
  assert.equal(commit.auditEvent.action, 'moderation.approved');
  assert.equal(commit.auditEvent.subject.type, 'intake_item');
  assert.equal(commit.auditEvent.subject.id, 'intake-1');
  assert.equal(
    commit.auditEvent.data?.researchCaseId,
    result.status === 'ok' ? result.researchCaseId : undefined,
  );
  assert.equal(commit.outboxMessage.topic, 'submissions.intake_item.moderated');
});

test('reject/spam flip status without opening a case', async () => {
  for (const decision of ['reject', 'spam'] as const) {
    const { commits, dependencies } = fixture(identity('admin'), submission());
    const result = await commitSubmissionDecision(
      { intakeItemId: 'intake-1', decision, reason: 'Checked and decided.' },
      dependencies,
    );
    assert.equal(result.status, 'ok');
    assert.equal(result.status === 'ok' ? result.researchCaseId : 'n/a', undefined);
    assert.equal(commits[0]?.auditEvent.action, 'moderation.rejected');
  }
});

test('the audit actor comes from the verified session, never a form field', async () => {
  const { commits, dependencies } = fixture(identity('admin'), submission());

  await commitSubmissionDecision(
    { intakeItemId: 'intake-1', decision: 'reject', reason: 'Out of scope.' },
    dependencies,
  );

  assert.deepEqual(commits[0]?.auditEvent.actor, {
    id: 'user-1',
    type: 'user',
    displayName: 'staff@example.com',
  });
});

test('a race that resolves the row first is reported as already_processed, not failed', async () => {
  const { dependencies } = fixture(identity('admin'), submission());
  const result = await commitSubmissionDecision(
    { intakeItemId: 'intake-1', decision: 'reject', reason: 'Out of scope.' },
    {
      ...dependencies,
      async commit(input) {
        // Simulates the UPDATE ... WHERE status = 'quarantined' guard finding zero rows because
        // another operator's decision committed first; applyState throws, so commit rejects too,
        // exactly like the real transaction wrapper.
        await input.applyState({
          query: async () => ({ rowCount: 0 }),
        } as unknown as pg.PoolClient);
        return { eventId: input.auditEvent.id, replayed: false };
      },
    },
  );
  assert.equal(result.status, 'already_processed');
});

test('a failing transaction reports failure rather than throwing into the render', async () => {
  const { dependencies } = fixture(identity('admin'), submission());
  const result = await commitSubmissionDecision(
    { intakeItemId: 'intake-1', decision: 'reject', reason: 'Out of scope.' },
    {
      ...dependencies,
      commit: async () => {
        throw new Error('deadlock detected');
      },
    },
  );

  assert.equal(result.status, 'failed');
  assert.match(result.status === 'failed' ? result.message : '', /deadlock/);
});
