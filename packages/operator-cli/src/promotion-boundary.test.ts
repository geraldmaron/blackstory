
/**
 * PROVES the acceptance-critical invariant for: an operator can PROPOSE (submit a lead,
 * register a source, attach evidence) but publishing always requires a distinct, fresh-auth
 * promotion action never the same call, never the same identity, never something this
 * package's own surface can perform.
 *
 * This test does not reimplement the promotion gate or the research-case authorization gate.
 * It imports and exercises the real /032 code
 * (`evaluatePromotionGate`, packages/domain/src/promotion/controls.ts) and the real
 * server authorization gate (`assertResearchCaseActionAuthorized`,
 * packages/firebase/src/firestore/research-case.ts admin-auth.ts) directly.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluatePromotionGate,
  type PromotionClaim,
  type PromotionEvidence,
} from '@blap/domain';
import {
  AdminAuthorizationError,
  assertResearchCaseActionAuthorized,
  executeAuthorizedResearchCaseAction,
  type VerifiedAdminToken,
} from '@blap/firebase';
import * as operatorCli from './index.ts';
import { prepareLeadIntake } from './intake.ts';

const NOW = '2026-07-17T04:00:00.000Z';
const NOW_EPOCH = Math.floor(Date.parse(NOW) / 1000);

function evidence(id: string, lineageRootId: string): PromotionEvidence {
  return {
    evidenceId: id,
    sourceId: `source-${id}`,
    sourceOrganizationId: `organization-${id}`,
    lineageRootId,
    independenceGroupId: `independent-${lineageRootId}`,
    role: 'supporting',
    credible: true,
    reputation: 'authoritative',
    quality: 0.9,
    contentFingerprint: `fingerprint-${id}`,
  };
}

function wellSupportedClaim(proposerId: string): PromotionClaim {
  return {
    claimId: 'claim-1',
    claimVersionId: 'claim-1-v1',
    entityId: 'entity-1',
    claimClass: 'standard',
    confidence: 0.9,
    proposerId,
    evidence: [evidence('one', 'lineage-one'), evidence('two', 'lineage-two')],
    contradictionSearch: {
      completed: true,
      searchedAt: NOW,
      querySummary: 'Searched registered sources for contradictory values.',
      reviewerId: 'reviewer-2',
    },
  };
}

function adminToken(overrides: Partial<VerifiedAdminToken> = {}): VerifiedAdminToken {
  return {
    uid: 'operator-1',
    auth_time: NOW_EPOCH,
    amr: ['mfa'],
    ...overrides,
  };
}

test('the domain promotion gate refuses self-approval: same identity as proposer and approver', () => {
  const claim = wellSupportedClaim('operator-1');
  const result = evaluatePromotionGate({ claim, approverId: 'operator-1' });
  assert.equal(result.approved, false);
  assert.ok(result.reasons.includes('proposer_approver_conflict'));
});

test('the domain promotion gate approves the same claim once a distinct approver reviews it', () => {
  const claim = wellSupportedClaim('operator-1');
  const result = evaluatePromotionGate({ claim, approverId: 'reviewer-2' });
  assert.equal(result.approved, true);
  assert.equal(result.reasons.length, 0);
});

test('the operator identity that proposed a lead has no permission to promote or publish anything', () => {
  // The operator's proposer-only permission set is `research:write` (no publication role)
  // exactly what packages/operator-cli stamps onto every proposal, and never more than that.
  const proposerToken = adminToken({ bb_claims_version: 1, bb_roles: ['research'] });
  assert.throws(
    () => assertResearchCaseActionAuthorized(proposerToken, 'promote'),
    /publication:publish/,
  );
  assert.throws(
    () =>
      executeAuthorizedResearchCaseAction(proposerToken, 'promote', () => {
        throw new Error('must never run');
      }),
    (error: unknown) => error instanceof AdminAuthorizationError && error.code === 'ADMIN_PERMISSION_DENIED',
  );
});

test('even a publication-permitted token cannot promote without a FRESH, separate authentication event', () => {
  const stalePublicationToken = adminToken({
    bb_claims_version: 1,
    bb_roles: ['publication'],
    auth_time: NOW_EPOCH - 3_600, // one hour old — well past the 10-minute reauth window
  });
  assert.throws(
    () =>
      executeAuthorizedResearchCaseAction(stalePublicationToken, 'promote', () => 'published', {
        nowEpochSeconds: NOW_EPOCH,
      }),
    (error: unknown) => error instanceof AdminAuthorizationError && error.code === 'ADMIN_REAUTH_REQUIRED',
  );

  const freshPublicationToken = adminToken({
    bb_claims_version: 1,
    bb_roles: ['publication'],
    auth_time: NOW_EPOCH,
  });
  const published = executeAuthorizedResearchCaseAction(
    freshPublicationToken,
    'promote',
    () => 'published',
    { nowEpochSeconds: NOW_EPOCH },
  );
  assert.equal(published, 'published');
});

test('a prepared operator intake outcome carries no approval, publication, or promotion field', () => {
  const outcome = prepareLeadIntake(
    { description: 'A lead used only to inspect the shape of the outcome object.', url: 'https://archive.example.org/x' },
    {
      identity: { operatorId: 'operator-1', sessionId: 'session-1', source: 'cli' },
      privacyPepper: 'test-only-pepper',
      nowMs: Date.parse(NOW),
    },
  );
  assert.equal(outcome.accepted, true);
  const forbiddenKeys = ['approved', 'published', 'promotionStage', 'releaseId', 'approverId'];
  for (const key of forbiddenKeys) {
    assert.equal(Object.hasOwn(outcome, key), false, `outcome unexpectedly has "${key}"`);
  }
});

test('this package exports no function capable of promoting, approving, or publishing', () => {
  const forbidden = /promote|approve|publish|activate|retract/iu;
  const offending = Object.keys(operatorCli).filter((name) => forbidden.test(name));
  assert.deepEqual(offending, [], `unexpected publish-capable export(s): ${offending.join(', ')}`);
});
