import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertContract,
  assertIndependentApproval,
  assertModelAdmitted,
  assertSeparateRepairInvocation,
  blackHistoryProfile,
  evaluateStopping,
  parseStructuredModelOutput,
  rankFrontierTasks,
  type FrontierTask,
  type ModelInvocation,
  type ReviewDecision,
} from './index.js';

const invocation: ModelInvocation = {
  schemaVersion: '1.0.0',
  id: 'invocation-original',
  activityId: 'activity-original',
  provider: 'openrouter',
  modelId: 'deepseek/deepseek-v3.2',
  modelFamily: 'deepseek',
  providerRoute: { provider: 'example' },
  priceSnapshot: { inputPerMillion: 1 },
  promptHash: 'a'.repeat(64),
  outputSchemaId: 'ResearchCase',
  outputSchemaVersion: '1.0.0',
  benchmarkVersion: 'case-extraction-1',
  rawResponse: '',
  status: 'pending',
  repairOfInvocationId: null,
};

function frontierTask(id: string, entropy: number): FrontierTask {
  return {
    schemaVersion: '1.0.0',
    id,
    caseId: 'case-1',
    taskType: 'query',
    targetId: null,
    riskWeight: 1,
    expectedEntropyReduction: entropy,
    sourceNovelty: 0,
    contradictionValue: 0,
    normalizedCost: 1,
    score: entropy,
    hop: 0,
    status: 'completed',
  };
}

test('the Black history profile is canonical, bounded, and deny-by-default', () => {
  assert.equal(blackHistoryProfile.budgets.standard.queries, 40);
  assert.equal(blackHistoryProfile.budgets.highImpact.paidModelUsd, 10);
  assert.equal(blackHistoryProfile.publication.automaticPublicPromotion, false);
  const modelIds = blackHistoryProfile.modelPolicies.flatMap((policy) => policy.modelIds);
  assert.equal(modelIds.includes('tencent/hy3:free'), false);
  assert.equal(modelIds.includes('openrouter/free'), false);
  assert.throws(
    () => assertModelAdmitted(blackHistoryProfile, 'free-batch', 'openrouter/free', true),
    /not admitted/,
  );
  assert.throws(
    () =>
      assertModelAdmitted(blackHistoryProfile, 'paid-research', 'deepseek/deepseek-v3.2', false),
    /no passing benchmark/,
  );
});

test('strict model parsing quarantines the untouched response instead of scanning braces', () => {
  const rawResponse = 'Proposed result: {"id":"case-1"}';
  const result = parseStructuredModelOutput({
    contract: 'ResearchCase',
    invocation: { ...invocation, rawResponse },
    quarantineId: 'quarantine-1',
    now: new Date('2026-07-21T00:00:00.000Z'),
    retentionDays: 90,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.quarantine.rawOutput, rawResponse);
    assert.equal(result.quarantine.retentionUntil, '2026-10-19T00:00:00.000Z');
  }
});

test('valid structured output passes the named canonical contract', () => {
  const researchCase = {
    schemaVersion: '1.0.0',
    id: 'case-1',
    profileId: 'black-history',
    title: 'A bounded question',
    riskClass: 'standard',
    status: 'open',
    createdBy: 'operator-1',
    createdAt: '2026-07-21T00:00:00.000Z',
  };
  const result = parseStructuredModelOutput({
    contract: 'ResearchCase',
    invocation: { ...invocation, rawResponse: JSON.stringify(researchCase) },
    quarantineId: 'unused',
    now: new Date('2026-07-21T00:00:00.000Z'),
    retentionDays: 90,
  });

  assert.deepEqual(result, { ok: true, value: researchCase });
  assert.deepEqual(assertContract('ResearchCase', researchCase), researchCase);
});

test('a repair must be a separate, linked activity', () => {
  const repair: ModelInvocation = {
    ...invocation,
    id: 'invocation-repair',
    activityId: 'activity-repair',
    repairOfInvocationId: invocation.id,
  };
  assert.doesNotThrow(() => assertSeparateRepairInvocation(invocation, repair));
  assert.throws(
    () =>
      assertSeparateRepairInvocation(invocation, { ...repair, activityId: invocation.activityId }),
    /separate invocation and activity/,
  );
});

test('frontier ranking and stop policy use information value, cost, and escalation', () => {
  assert.deepEqual(
    rankFrontierTasks([frontierTask('low', 0.01), frontierTask('high', 0.2)]).map(
      (task) => task.id,
    ),
    ['high', 'low'],
  );
  const lowTasks = [
    frontierTask('one', 0.01),
    frontierTask('two', 0.02),
    frontierTask('three', 0.03),
  ];
  assert.equal(
    evaluateStopping({
      profile: blackHistoryProfile,
      needs: [],
      recentCompletedTasks: lowTasks,
      unresolvedEscalationTriggers: [],
      hardCapReached: false,
    }).decision,
    'stop',
  );
  assert.equal(
    evaluateStopping({
      profile: blackHistoryProfile,
      needs: [],
      recentCompletedTasks: lowTasks,
      unresolvedEscalationTriggers: ['material contradiction'],
      hardCapReached: true,
    }).decision,
    'escalate',
  );
});

test('review approval cannot share actor or model lineage with production', () => {
  const decision: ReviewDecision = {
    schemaVersion: '1.0.0',
    id: 'review-1',
    artifactId: 'artifact-1',
    decision: 'approve',
    reviewerActorId: 'reviewer-1',
    reviewerModelFamily: 'qwen',
    producerActorId: 'producer-1',
    producerModelFamily: 'kimi',
    findings: [],
    decidedAt: '2026-07-21T00:00:00.000Z',
  };
  assert.doesNotThrow(() => assertIndependentApproval(decision));
  assert.throws(
    () => assertIndependentApproval({ ...decision, reviewerModelFamily: 'kimi' }),
    /different model families/,
  );
});
