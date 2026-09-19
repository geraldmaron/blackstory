import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { getOpsPostgresPool } from '@repo/data-access';
import {
  blackHistoryProfile,
  validateExecutionPlan,
  type ResearchExecutionPlan,
} from '@repo/research-kernel';
import {
  claimResearchTask,
  completeResearchTask,
  researchExecutionStatus,
  startResearchExecution,
  type TaskModelMetadata,
} from './research-execution.js';

function fixturePlan(prefix = `execution-test-${randomUUID()}`): ResearchExecutionPlan {
  const budget = {
    queries: 4,
    candidateUrls: 5,
    fullCaptures: 4,
    relationshipHops: 2,
    durationMinutes: 5,
    paidModelUsd: 0.4,
  };
  return {
    schemaVersion: '1.0.0',
    budgetClass: 'standard',
    profile: {
      ...blackHistoryProfile,
      id: prefix,
      version: '1.0.0',
      name: 'River restoration archive',
      scope: { domain: 'environmental history' },
      vocabulary: { entityKinds: ['organization', 'person', 'place'] },
      sensitivityRules: [],
      sourceFitness: [],
      queryPacks: {},
      riskClasses: [],
      modelPolicies: [
        {
          mode: 'trusted-session',
          modelIds: ['fixture-model'],
          authority: ['proposal'],
          requiresBenchmark: false,
          mayApprove: false,
        },
      ],
      budgets: { standard: budget, highImpact: budget },
      stopping: { ...blackHistoryProfile.stopping, requireContradictionSearch: true },
    },
    run: {
      schemaVersion: '1.0.0',
      id: `${prefix}-run`,
      caseId: `${prefix}-case`,
      profileId: prefix,
      profileVersion: '1.0.0',
      policyVersion: '1.0.0',
      mode: 'trusted-session',
      status: 'pending',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: null,
      costUsd: 0,
      counts: {},
      terminalReason: null,
    },
    questions: [
      {
        schemaVersion: '1.0.0',
        id: `${prefix}-question`,
        caseId: `${prefix}-case`,
        question: 'Which organizations disputed the restoration plan?',
        priority: 1,
        status: 'open',
      },
    ],
    needs: [
      {
        schemaVersion: '1.0.0',
        id: `${prefix}-need`,
        questionId: `${prefix}-question`,
        claimClass: 'historical-assertion',
        description: 'Find contemporary counter-evidence',
        mandatory: true,
        contradictionSearch: true,
        status: 'open',
      },
    ],
    tasks: [0, 1].map((index) => ({
      frontier: {
        schemaVersion: '1.0.0',
        id: `${prefix}-task-${index}`,
        caseId: `${prefix}-case`,
        taskType: index === 0 ? 'contradictionSearch' : 'verify',
        targetId: null,
        riskWeight: 1,
        expectedEntropyReduction: 1,
        sourceNovelty: 0,
        contradictionValue: 0,
        normalizedCost: 1,
        score: 1,
        hop: 0,
        status: 'pending',
      },
      evidenceNeedId: `${prefix}-need`,
      dependsOn: index === 0 ? [] : [`${prefix}-task-0`],
      input: { question: 'Inspect dissent and alternative explanations' },
      outputContract: 'ResearchTaskReport',
      maxAttempts: 2,
      maxCostUsdPerAttempt: index === 0 ? 0.2 : 0,
    })),
  };
}

const model: TaskModelMetadata = {
  provider: 'other',
  modelId: 'fixture-model',
  modelFamily: 'fixture',
  providerRoute: { offline: true, attempts: 1 },
  accounting: {
    promptTokens: null,
    completionTokens: null,
    costUsd: null,
    source: null,
    incomplete: true,
  },
  priceSnapshot: { reservationUsd: 0.2 },
  promptHash: 'a'.repeat(64),
  outputSchemaId: 'ResearchTaskReport',
  outputSchemaVersion: '1.0.0',
  benchmarkVersion: 'not-required-by-fixture-profile',
};
const report = JSON.stringify({
  summary: 'No factual conclusion is established by this fixture.',
  limitations: ['Synthetic execution test; no historical evidence was retrieved.'],
  evidence: [],
});

test('execution manifests reject cycles, scope leaks, unaffordable retries, and missing contradiction work', () => {
  const plan = fixturePlan();
  assert.equal(validateExecutionPlan(plan).profile.scope.domain, 'environmental history');
  assert.throws(
    () => validateExecutionPlan({ ...plan, tasks: [...plan.tasks, plan.tasks[0]!] }),
    /Duplicate task/,
  );
  assert.throws(
    () =>
      validateExecutionPlan({
        ...plan,
        tasks: plan.tasks.map((task) => ({
          ...task,
          frontier: { ...task.frontier, caseId: 'different-case' },
        })),
      }),
    /run case/,
  );
  assert.throws(
    () =>
      validateExecutionPlan({
        ...plan,
        tasks: plan.tasks.map((task) => ({ ...task, maxCostUsdPerAttempt: 1 })),
      }),
    /budget/,
  );
  assert.throws(
    () =>
      validateExecutionPlan({
        ...plan,
        tasks: plan.tasks.map((task, index) => ({
          ...task,
          dependsOn: [plan.tasks[index === 0 ? 1 : 0]!.frontier.id],
        })),
      }),
    /cycle/,
  );
  assert.throws(
    () =>
      validateExecutionPlan({
        ...plan,
        needs: plan.needs.map((need) => ({ ...need, contradictionSearch: false })),
      }),
    /contradiction/,
  );
});

test(
  'Postgres execution resumes once, scopes leases, quarantines invalid output, and preserves review needs',
  { skip: !process.env.RESEARCH_TEST_DATABASE_URL },
  async () => {
    const connectionString = process.env.RESEARCH_TEST_DATABASE_URL!;
    const url = new URL(connectionString);
    assert.ok(
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
      'Integration tests require an isolated loopback database',
    );
    const pool = getOpsPostgresPool({ DATABASE_URL: connectionString });
    const plans = [fixturePlan(), fixturePlan()];
    try {
      for (const plan of plans)
        assert.equal((await startResearchExecution(pool, plan)).created, true);
      const plan = plans[0]!;
      assert.equal((await startResearchExecution(pool, plan)).created, false);
      await assert.rejects(
        startResearchExecution(pool, { ...plan, run: { ...plan.run, policyVersion: '2.0.0' } }),
        /different manifest/,
      );
      const competing = await Promise.all([
        claimResearchTask(pool, plan.run.id, 'worker-a'),
        claimResearchTask(pool, plan.run.id, 'worker-b'),
      ]);
      assert.equal(
        competing.filter(Boolean).length,
        1,
        'A dependent task cannot run before its source task',
      );
      const abandoned = competing.find(Boolean)!;
      await pool.query(
        "UPDATE research.frontier_tasks SET leased_until=clock_timestamp()-interval '1 second' WHERE id=$1",
        [abandoned.task.frontier.id],
      );
      const resumed = await claimResearchTask(pool, plan.run.id, 'worker-resumed');
      assert.ok(resumed);
      assert.equal(resumed.attempt, 2);
      assert.notEqual(resumed.leaseToken, abandoned.leaseToken);
      await assert.rejects(completeResearchTask(pool, abandoned, report, model), /lease/);
      const invalid = await completeResearchTask(pool, resumed, 'not JSON', model);
      assert.equal(invalid.valid, false);
      assert.equal(await claimResearchTask(pool, plan.run.id, 'worker-resumed'), null);
      const failure = await researchExecutionStatus(pool, plan.run.id);
      assert.equal((failure.run as { status: string }).status, 'failed');
      assert.equal(
        Number((failure.run as { reserved_cost_usd: string }).reserved_cost_usd),
        0.4,
        'An uncertain attempt retains its reservation',
      );
      const quarantined = await pool.query(
        'SELECT raw_output FROM research.model_output_quarantine WHERE invocation_id IN (SELECT id FROM research.model_invocations WHERE activity_id=$1)',
        [resumed.activityId],
      );
      assert.equal(quarantined.rows[0]?.raw_output, 'not JSON');

      const successPlan = plans[1]!;
      const first = await claimResearchTask(pool, successPlan.run.id, 'independent-worker');
      assert.ok(first);
      const receipt = await completeResearchTask(pool, first, report, model);
      assert.equal(receipt.valid, true);
      assert.deepEqual(
        await completeResearchTask(pool, first, report, model),
        receipt,
        'A lost completion response can be retried without a second invocation',
      );
      await assert.rejects(completeResearchTask(pool, first, 'changed result', model), /receipt/);
      const second = await claimResearchTask(pool, successPlan.run.id, 'independent-worker');
      assert.ok(second);
      assert.equal(second.dependencies.length, 1);
      assert.deepEqual(second.dependencies[0]?.output, JSON.parse(report));
      assert.equal((await completeResearchTask(pool, second, report, model)).valid, true);
      const status = await researchExecutionStatus(pool, successPlan.run.id);
      assert.equal((status.run as { status: string }).status, 'succeeded');
      assert.equal((status.evidenceNeeds as { status: string }[])[0]?.status, 'open');
      assert.equal(status.publicationAuthorized, false);
      const artifacts = await pool.query('SELECT status FROM research.artifacts WHERE run_id=$1', [
        successPlan.run.id,
      ]);
      assert.ok(artifacts.rows.every((row) => row.status === 'proposed'));
      assert.equal(await claimResearchTask(pool, successPlan.run.id, 'worker-new'), null);
    } finally {
      for (const plan of plans) {
        const runId = plan.run.id;
        await pool.query(
          "UPDATE research.frontier_tasks SET status='cancelled',leased_to=NULL,lease_token=NULL,leased_until=NULL,result_artifact_id=NULL WHERE run_id=$1",
          [runId],
        );
        await pool.query(
          'DELETE FROM research.artifact_dependencies WHERE artifact_id IN (SELECT id FROM research.artifacts WHERE run_id=$1)',
          [runId],
        );
        await pool.query('DELETE FROM research.artifacts WHERE run_id=$1', [runId]);
        await pool.query(
          'DELETE FROM research.model_output_quarantine WHERE invocation_id IN (SELECT id FROM research.model_invocations WHERE activity_id IN (SELECT id FROM research.agent_activities WHERE run_id=$1))',
          [runId],
        );
        await pool.query(
          'DELETE FROM research.model_invocations WHERE activity_id IN (SELECT id FROM research.agent_activities WHERE run_id=$1)',
          [runId],
        );
        await pool.query('DELETE FROM research.agent_activities WHERE run_id=$1', [runId]);
        await pool.query('DELETE FROM research.frontier_task_dependencies WHERE run_id=$1', [
          runId,
        ]);
        await pool.query('DELETE FROM research.frontier_tasks WHERE run_id=$1', [runId]);
        await pool.query('DELETE FROM research.runs WHERE id=$1', [runId]);
        await pool.query('DELETE FROM research.cases WHERE id=$1', [plan.run.caseId]);
        await pool.query('DELETE FROM research.research_profiles WHERE id=$1', [plan.profile.id]);
      }
      await pool.end();
    }
  },
);
