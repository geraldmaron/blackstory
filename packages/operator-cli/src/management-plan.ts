import { querySourceLibrary } from '@repo/ops-data/source-library';
/** Shared bounded plan and proposal readback for session and hosted executors. */
import { createHash } from 'node:crypto';
import {
  blackHistoryProfile,
  assertContract,
  type ResearchExecutionPlan,
} from '@repo/research-kernel';
import {
  startResearchExecution,
  loadResearchExecutionPlan,
  type ExecutionPool,
} from './research-execution.js';
import type { WorkItem, WorkProposal } from '@repo/ops-data/management/contracts';

export function managedResearchPlan(
  work: WorkItem,
  modelId: string,
  catalog: unknown,
): ResearchExecutionPlan {
  const runId = `managed-${work.id}-v${work.version + 1}`;
  const profile = {
    ...blackHistoryProfile,
    id: `blackstory-managed-research-${createHash('sha256').update(modelId).digest('hex').slice(0, 16)}`,
    version: blackHistoryProfile.version,
    modelPolicies: [
      {
        mode: 'trusted-session' as const,
        modelIds: [modelId],
        authority: ['proposal'] as ['proposal'],
        requiresBenchmark: false,
        mayApprove: false,
      },
    ],
  };
  const caseId = `${runId}-case`;
  const specs = [
    { type: 'resolveEntity', contract: 'ManagementResearchPlan', action: 'plan', dependencies: [] },
    {
      type: 'contradictionSearch',
      contract: 'ResearchSearchResult',
      action: 'search',
      dependencies: [0],
    },
    {
      type: 'capture',
      contract: 'ResearchAcquisitionResult',
      action: 'acquire',
      dependencies: [0, 1],
    },
    { type: 'extract', contract: 'ManagementProposal', action: 'draft', dependencies: [0, 1, 2] },
    {
      type: 'verify',
      contract: 'ManagementProposal',
      action: 'review',
      dependencies: [0, 1, 2, 3],
    },
  ];
  return assertContract('ResearchExecutionPlan', {
    schemaVersion: '1.0.0',
    budgetClass: 'standard',
    profile,
    run: {
      schemaVersion: '1.0.0',
      id: runId,
      caseId,
      profileId: profile.id,
      profileVersion: profile.version,
      policyVersion: '1.0.0',
      mode: 'trusted-session',
      status: 'pending',
      startedAt: work.createdAt,
      completedAt: null,
      costUsd: 0,
      counts: {},
      terminalReason: null,
    },
    questions: [
      {
        schemaVersion: '1.0.0',
        id: `${runId}-q`,
        caseId,
        question: work.request.request,
        priority: 1,
        status: 'open',
      },
    ],
    needs: [
      {
        schemaVersion: '1.0.0',
        id: `${runId}-n`,
        questionId: `${runId}-q`,
        claimClass: 'historical-assertion',
        description: 'Verify identity and proposed record changes, including counterevidence.',
        mandatory: true,
        contradictionSearch: true,
        status: 'open',
      },
    ],
    tasks: specs.map((spec, index) => ({
      frontier: {
        schemaVersion: '1.0.0',
        id: `${runId}-${index}`,
        caseId,
        taskType: spec.type,
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
      evidenceNeedId: `${runId}-n`,
      dependsOn: spec.dependencies.map((index) => `${runId}-${index}`),
      input: {
        executor: 'management',
        action: spec.action,
        ...(index === 0 ? { requiresCollectionPlan: true } : {}),
        request: work.request.request,
        catalog:
          index === 0
            ? catalog
            : {
                recordsFromTaskId: `${runId}-0`,
                guidanceFromTaskId: `${runId}-0`,
              },
        modelId,
      },
      outputContract: spec.contract,
      maxAttempts: 2,
      maxCostUsdPerAttempt: ['plan', 'draft', 'review'].includes(spec.action)
        ? 0.3
        : spec.action === 'acquire'
          ? 0.1
          : 0,
    })),
  });
}

export async function prepareManagedResearch(
  pool: ExecutionPool,
  work: WorkItem,
  modelId: string,
  catalog: unknown,
): Promise<ResearchExecutionPlan> {
  const dbPlan = await pool.connect();
  let plan: ResearchExecutionPlan | undefined;
  try {
    const existing = await dbPlan.query('SELECT execution_plan FROM research.runs WHERE id=$1', [
      `managed-${work.id}-v${work.version + 1}`,
    ]);
    const library = existing.rows[0]
      ? null
      : await querySourceLibrary(dbPlan, { question: work.request.request, limit: 30 });
    const evidenceNeedLibraries = [];
    if (!existing.rows[0])
      for (const assertionClass of ['record_fact', 'chronology', 'place', 'historical_synthesis']) {
        evidenceNeedLibraries.push({
          assertionClass,
          expectedUse:
            'Starting recommendations; the planning task must narrow the assertion and explain why a collection should contain it.',
          recommendations: await querySourceLibrary(dbPlan, { assertionClass, limit: 20 }),
        });
      }
    const feedback = await dbPlan.query(
      `SELECT action,entity_ids,reason,version FROM research.management_work_decisions
      WHERE work_id=$1 ORDER BY created_at,id`,
      [work.id],
    );
    if (!existing.rows[0])
      plan = managedResearchPlan(work, modelId, {
        records: catalog,
        feedback: feedback.rows,
        sourceLibrary: library,
        evidenceNeedLibraries,
      });
  } finally {
    dbPlan.release();
  }
  // Loading the pinned plan acquires its own connection; do not retain one while waiting.
  plan ??= await loadResearchExecutionPlan(pool, `managed-${work.id}-v${work.version + 1}`);
  await startResearchExecution(pool, plan);
  return plan;
}

export async function readManagedProposal(
  pool: ExecutionPool,
  runId: string,
  actorId: string,
): Promise<WorkProposal> {
  const db = await pool.connect();
  try {
    const result = await db.query(
      `SELECT a.extensions->'output' AS output FROM research.frontier_tasks t
      JOIN research.artifacts a ON a.id=t.result_artifact_id WHERE t.run_id=$1 AND t.id=$2 AND t.status='completed'
      AND a.payload_disposed_at IS NULL`,
      [runId, `${runId}-4`],
    );
    if (!result.rows[0]) throw new Error('Research did not produce a validated proposal');
    const proposal = assertContract('ManagementProposal', result.rows[0].output);
    return {
      ...proposal,
      researchRunIds: [runId],
      changes: proposal.changes.map((change) => ({
        ...change,
        reviewBasis: 'self_review',
        producerActorId: actorId,
        reviewerActorId: actorId,
      })),
    };
  } finally {
    db.release();
  }
}
