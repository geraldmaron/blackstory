/**
 * Verifies server-side authorization for research transitions, assignments,
 * publication promotion, and replacement-release retraction.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createResearchCase,
  transitionResearchCase,
} from '../../../domain/src/research-case/index.js';
import type { VerifiedAdminToken } from '../admin-auth.js';
import {
  executeAuthorizedResearchCaseAction,
  executeAuthorizedResearchCaseTransition,
} from './research-case.js';

const NOW = '2026-07-17T04:00:00.000Z';
const NOW_EPOCH = Math.floor(Date.parse(NOW) / 1000);

function token(
  role: 'research' | 'publication' | 'admin',
  authTime = NOW_EPOCH,
): VerifiedAdminToken {
  return {
    uid: `${role}-1`,
    auth_time: authTime,
    bb_claims_version: 1,
    bb_roles: [role],
    amr: ['mfa'],
  };
}

function candidate() {
  return createResearchCase({
    id: 'case-1',
    candidateId: 'candidate-1',
    title: 'Candidate',
    checklist: { items: [] },
    now: NOW,
  });
}

test('research role can execute a legal domain transition on the server', () => {
  const record = candidate();
  const result = executeAuthorizedResearchCaseTransition(
    token('research'),
    record,
    'relevance_review',
    (current) =>
      transitionResearchCase(current, {
        targetState: 'relevance_review',
        actorId: 'research-1',
        now: NOW,
        reasonCode: 'new_evidence_received',
        reason: 'Research review started.',
      }),
  );
  assert.equal(result.state, 'relevance_review');
});

test('publication role cannot mutate research state and callback never runs', () => {
  let called = false;
  assert.throws(
    () =>
      executeAuthorizedResearchCaseTransition(
        token('publication'),
        candidate(),
        'relevance_review',
        (record) => {
          called = true;
          return { ...record, state: 'relevance_review' };
        },
      ),
    /research:write/,
  );
  assert.equal(called, false);
});

test('research role cannot promote or retract content', () => {
  assert.throws(
    () =>
      executeAuthorizedResearchCaseAction(token('research'), 'promote', () => 'published', {
        nowEpochSeconds: NOW_EPOCH,
      }),
    /publication:publish/,
  );
  assert.throws(
    () =>
      executeAuthorizedResearchCaseTransition(
        token('research'),
        { state: 'minimum_record' },
        'retracted',
        (record) => ({ ...record, state: 'retracted' }),
        { nowEpochSeconds: NOW_EPOCH },
      ),
    /publication:retract/,
  );
});

test('publication role can promote only with recent authentication', () => {
  const promoted = executeAuthorizedResearchCaseAction(
    token('publication'),
    'promote',
    () => 'publication-candidate-1',
    { nowEpochSeconds: NOW_EPOCH },
  );
  assert.equal(promoted, 'publication-candidate-1');

  assert.throws(
    () =>
      executeAuthorizedResearchCaseAction(
        token('publication', NOW_EPOCH - 3600),
        'promote',
        () => 'publication-candidate-2',
        { nowEpochSeconds: NOW_EPOCH, maxAgeSeconds: 600 },
      ),
    /Fresh authentication/,
  );
});

test('server rejects transition callbacks that return an unexpected state', () => {
  assert.throws(
    () =>
      executeAuthorizedResearchCaseTransition(
        token('research'),
        candidate(),
        'relevance_review',
        (record) => record,
      ),
    /instead of requested/,
  );
});

test('admin inherits both research and publication workflow permissions', () => {
  const assigned = executeAuthorizedResearchCaseAction(
    token('admin'),
    'assign',
    () => 'assignment-1',
  );
  const retracted = executeAuthorizedResearchCaseTransition(
    token('admin'),
    { state: 'minimum_record' },
    'retracted',
    (record) => ({ ...record, state: 'retracted' }),
    { nowEpochSeconds: NOW_EPOCH },
  );
  assert.equal(assigned, 'assignment-1');
  assert.equal(retracted.state, 'retracted');
});
