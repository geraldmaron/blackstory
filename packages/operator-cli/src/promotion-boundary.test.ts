/**
 * PROVES the acceptance-critical invariant for: an operator can PROPOSE (submit a lead,
 * register a source, attach evidence) but publishing always requires a distinct, fresh-auth
 * promotion action never the same call, never the same identity, never something this
 * package's own surface can perform.
 *
 * This test exercises the domain promotion gate and proves the operator package
 * exposes no acceptance or publication operation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluatePromotionGate, type PromotionClaim, type PromotionEvidence } from '@repo/domain';
import * as operatorCli from './index.ts';
import { prepareLeadIntake } from './intake.ts';

const NOW = '2026-07-17T04:00:00.000Z';

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

test('a prepared operator intake outcome carries no approval, publication, or promotion field', () => {
  const outcome = prepareLeadIntake(
    {
      description: 'A lead used only to inspect the shape of the outcome object.',
      url: 'https://archive.example.org/x',
    },
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
