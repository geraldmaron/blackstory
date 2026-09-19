/** Durable, bounded proposal execution on the canonical Postgres research ledger. */
import { randomUUID } from 'node:crypto';
import { writeModelInvocation } from './model-invocation-log.js';
import { sha256Json, sha256Bytes, type JsonValue } from '@repo/domain';
import { assertQuoteAttached, type HarnessRawSubject } from '@repo/research-harness';
import {
  assertContract,
  validateExecutionPlan,
  type ModelInvocation,
  type ResearchExecutionPlan,
  type ResearchTaskSpec,
  type ResearchTaskLease,
} from '@repo/research-kernel';

export interface ExecutionClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[] }>;
  release(): void;
}
export interface ExecutionPool {
  connect(): Promise<ExecutionClient>;
}

export type { ResearchTaskLease } from '@repo/research-kernel';

export type TaskModelMetadata = Omit<
  ModelInvocation,
  'schemaVersion' | 'id' | 'activityId' | 'rawResponse' | 'status' | 'repairOfInvocationId'
>;

const taskTypes: Record<ResearchTaskSpec['frontier']['taskType'], string> = {
  query: 'query',
  capture: 'capture',
  extract: 'extract',
  verify: 'verify',
  resolveEntity: 'resolve_entity',
  expandRelationship: 'expand_relationship',
  contradictionSearch: 'contradiction_search',
  rightsReview: 'rights_review',
};

function digest(value: unknown): string {
  return sha256Json(value as JsonValue).digest;
}

async function transaction<T>(
  pool: ExecutionPool,
  work: (client: ExecutionClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // PostgreSQL enforces membership. This does not fabricate an HTTP JWT or a human identity.
    await client.query('SET LOCAL ROLE research_worker');
    await client.query("SET LOCAL statement_timeout = '30s'");
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** The manifest is immutable. Replaying the same run is safe; changing it requires a new run. */
export async function startResearchExecution(
  pool: ExecutionPool,
  value: unknown,
): Promise<{ runId: string; created: boolean }> {
  const plan = validateExecutionPlan(value);
  const hash = digest(plan);
  const budget = plan.profile.budgets[plan.budgetClass];
  const sourceUrls = new Set<string>();
  let payloadRetentionUntil = Date.now() + plan.profile.retention.deadLetterDraftDays * 86_400_000;
  for (const task of plan.tasks) {
    const sources = [
      task.input.source,
      ...(Array.isArray(task.input.sources) ? task.input.sources : []),
    ];
    for (const source of sources) {
      if (source && typeof source === 'object' && 'cites' in source && Array.isArray(source.cites))
        for (const url of source.cites) if (typeof url === 'string') sourceUrls.add(url);
    }
    if (task.input.executor === 'builtin') {
      const action = assertContract('ResearchWorkerInput', task.input);
      if (action.operation === 'acquire')
        for (const decision of action.decisions) {
          sourceUrls.add(decision.sourceUrl);
          payloadRetentionUntil = Math.min(payloadRetentionUntil, Date.parse(decision.expiresAt));
        }
    }
  }
  return transaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [plan.run.id]);
    const existing = await db.query('SELECT manifest_hash FROM research.runs WHERE id = $1', [
      plan.run.id,
    ]);
    if (existing.rows[0]) {
      if (existing.rows[0].manifest_hash !== hash)
        throw new Error('Run identity already belongs to a different manifest');
      return { runId: plan.run.id, created: false };
    }
    await db.query(
      `INSERT INTO research.research_profiles (id,version,schema_version,checksum,profile)
      VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (id,version) DO NOTHING`,
      [
        plan.profile.id,
        plan.profile.version,
        plan.profile.schemaVersion,
        digest(plan.profile),
        JSON.stringify(plan.profile),
      ],
    );
    const profile = await db.query(
      `SELECT profile = $3::jsonb AS matches FROM research.research_profiles WHERE id=$1 AND version=$2`,
      [plan.profile.id, plan.profile.version, JSON.stringify(plan.profile)],
    );
    if (profile.rows[0]?.matches !== true)
      throw new Error('Profile version already has different content');
    await db.query(
      `INSERT INTO research.cases (id,state,candidate_id,title,profile_id,profile_version,risk_class)
      VALUES ($1,'candidate',$1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [
        plan.run.caseId,
        plan.questions[0]?.question ?? plan.profile.name,
        plan.profile.id,
        plan.profile.version,
        plan.budgetClass,
      ],
    );
    const researchCase = await db.query(
      'SELECT profile_id,profile_version FROM research.cases WHERE id=$1',
      [plan.run.caseId],
    );
    if (
      researchCase.rows[0]?.profile_id !== plan.profile.id ||
      researchCase.rows[0]?.profile_version !== plan.profile.version
    ) {
      throw new Error('Case belongs to another profile version');
    }
    await db.query(
      `INSERT INTO research.runs
      (id,case_id,profile_id,profile_version,policy_version,mode,status,started_at,execution_plan,manifest_hash,max_cost_usd,deadline_at,payload_retention_until,retention_source_urls)
      VALUES ($1,$2,$3,$4,$5,$6,'pending',clock_timestamp(),$7::jsonb,$8,$9,clock_timestamp()+make_interval(secs=>$10),$11,$12)`,
      [
        plan.run.id,
        plan.run.caseId,
        plan.profile.id,
        plan.profile.version,
        plan.run.policyVersion,
        plan.run.mode,
        JSON.stringify(plan),
        hash,
        budget.paidModelUsd,
        budget.durationMinutes * 60,
        new Date(payloadRetentionUntil).toISOString(),
        [...sourceUrls],
      ],
    );
    for (const question of plan.questions)
      await db.query(
        `INSERT INTO research.research_questions
      (id,case_id,question,priority,status) VALUES ($1,$2,$3,$4,'open')`,
        [question.id, question.caseId, question.question, question.priority],
      );
    for (const need of plan.needs)
      await db.query(
        `INSERT INTO research.evidence_needs
      (id,question_id,claim_class,description,mandatory,contradiction_search,status) VALUES ($1,$2,$3,$4,$5,$6,'open')`,
        [
          need.id,
          need.questionId,
          need.claimClass,
          need.description,
          need.mandatory,
          need.contradictionSearch,
        ],
      );
    for (const spec of plan.tasks) {
      const t = spec.frontier;
      await db.query(
        `INSERT INTO research.frontier_tasks
        (id,case_id,run_id,evidence_need_id,task_type,target_id,risk_weight,expected_entropy_reduction,
         source_novelty,contradiction_value,normalized_cost,hop,idempotency_key,max_attempts,input,output_contract,max_cost_usd_per_attempt)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$1,$13,$14::jsonb,$15,$16)`,
        [
          t.id,
          t.caseId,
          plan.run.id,
          spec.evidenceNeedId,
          taskTypes[t.taskType],
          t.targetId,
          t.riskWeight,
          t.expectedEntropyReduction,
          t.sourceNovelty,
          t.contradictionValue,
          t.normalizedCost,
          t.hop,
          spec.maxAttempts,
          JSON.stringify(spec.input),
          spec.outputContract,
          spec.maxCostUsdPerAttempt,
        ],
      );
    }
    for (const spec of plan.tasks)
      for (const dependency of spec.dependsOn) {
        await db.query(
          `INSERT INTO research.frontier_task_dependencies (task_id,run_id,depends_on_task_id) VALUES ($1,$2,$3)`,
          [spec.frontier.id, plan.run.id, dependency],
        );
      }
    return { runId: plan.run.id, created: true };
  });
}

export async function claimResearchTask(
  pool: ExecutionPool,
  runId: string,
  workerId: string,
  leaseSeconds = 300,
): Promise<ResearchTaskLease | null> {
  return transaction(pool, async (db) => {
    const result = await db.query('SELECT * FROM research.claim_frontier_task($1,$2,$3)', [
      runId,
      workerId,
      leaseSeconds,
    ]);
    const row = result.rows[0];
    if (!row) {
      await reconcileRun(db, runId);
      return null;
    }
    const plan = await readPlan(db, runId);
    const task = plan.tasks.find((candidate) => candidate.frontier.id === row.id);
    if (!task) throw new Error('Leased task is absent from its immutable manifest');
    const activityId = randomUUID();
    await db.query(
      `INSERT INTO research.agent_activities
      (id,run_id,actor_id,actor_type,activity_type,started_at,frontier_task_id,frontier_attempt) VALUES ($1,$2,$3,'service',$4,clock_timestamp(),$5,$6)`,
      [activityId, runId, workerId, row.task_type, row.id, row.attempt_count],
    );
    const dependencies = await db.query(
      `SELECT parent.id AS task_id, artifact.extensions->'output' AS output
      FROM research.frontier_task_dependencies dependency
      JOIN research.frontier_tasks parent ON parent.id=dependency.depends_on_task_id
      JOIN research.artifacts artifact ON artifact.id=parent.result_artifact_id
      WHERE dependency.task_id=$1 AND artifact.payload_disposed_at IS NULL
        AND (artifact.retention_until IS NULL OR artifact.retention_until>clock_timestamp()) ORDER BY parent.id`,
      [row.id],
    );
    if (dependencies.rows.length !== task.dependsOn.length)
      throw new Error('A completed dependency has no result artifact');
    return {
      runId,
      task,
      workerId,
      activityId,
      leaseToken: String(row.lease_token),
      expiresAt: new Date(String(row.leased_until)).toISOString(),
      attempt: Number(row.attempt_count),
      dependencies: dependencies.rows.map((item) => ({
        taskId: String(item.task_id),
        output: item.output,
      })),
    };
  });
}

async function readPlan(db: ExecutionClient, runId: string): Promise<ResearchExecutionPlan> {
  const result = await db.query(
    'SELECT execution_plan,payload_retention_until FROM research.runs WHERE id=$1',
    [runId],
  );
  if (new Date(String(result.rows[0]?.payload_retention_until)).getTime() <= Date.now())
    throw new Error('Research run payload retention has expired');
  return validateExecutionPlan(result.rows[0]?.execution_plan);
}

export async function loadResearchExecutionPlan(
  pool: ExecutionPool,
  runId: string,
): Promise<ResearchExecutionPlan> {
  return transaction(pool, (db) => readPlan(db, runId));
}

export async function heartbeatResearchTask(
  pool: ExecutionPool,
  lease: ResearchTaskLease,
  seconds = 300,
): Promise<boolean> {
  assertContract('ResearchTaskLease', lease);
  return transaction(pool, async (db) => {
    const result = await db.query(
      'SELECT research.heartbeat_frontier_task($1,$2,$3,$4) AS renewed',
      [lease.task.frontier.id, lease.workerId, lease.leaseToken, seconds],
    );
    return result.rows[0]?.renewed === true;
  });
}

/** Invalid output is retained and fails the attempt. Task completion never satisfies an evidence need. */
export async function completeResearchTask(
  pool: ExecutionPool,
  lease: ResearchTaskLease,
  rawOutput: string,
  model?: TaskModelMetadata,
  executionFailure?: string,
): Promise<{ valid: boolean; artifactId: string; error?: string }> {
  assertContract('ResearchTaskLease', lease);
  if (Buffer.byteLength(rawOutput, 'utf8') > 256_000) throw new Error('Task output exceeds 256 KB');
  return transaction(pool, async (db) => {
    const runState = await db.query(
      'SELECT id,status,deadline_at FROM research.runs WHERE id=$1 FOR UPDATE',
      [lease.runId],
    );
    const receipt = await db.query(
      `SELECT artifact.id,artifact.content_hash,artifact.extensions FROM research.artifacts artifact
      JOIN research.agent_activities activity ON activity.id=artifact.activity_id
      WHERE artifact.idempotency_key=$1 AND artifact.run_id=$2 AND activity.id=$3 AND activity.actor_id=$4`,
      [
        `task-result:${lease.task.frontier.id}:${lease.attempt}`,
        lease.runId,
        lease.activityId,
        lease.workerId,
      ],
    );
    const prior = receipt.rows[0];
    if (prior) {
      const extensions = prior.extensions as { leaseTokenHash?: string; error?: string };
      if (
        prior.content_hash !== sha256Bytes(rawOutput).digest ||
        extensions.leaseTokenHash !== sha256Bytes(lease.leaseToken).digest
      ) {
        throw new Error('Completion receipt does not match the supplied lease and output');
      }
      return {
        valid: !extensions.error,
        artifactId: String(prior.id),
        ...(extensions.error ? { error: extensions.error } : {}),
      };
    }
    if (
      !['pending', 'running'].includes(String(runState.rows[0]?.status)) ||
      new Date(String(runState.rows[0]?.deadline_at)).getTime() <= Date.now()
    )
      throw new Error('Research run is terminal or its deadline has passed');
    const leased = await db.query(
      `SELECT task.* FROM research.frontier_tasks task WHERE id=$1 AND run_id=$2
      AND status='leased' AND leased_to=$3 AND lease_token=$4 AND leased_until >= clock_timestamp() FOR UPDATE`,
      [lease.task.frontier.id, lease.runId, lease.workerId, lease.leaseToken],
    );
    if (!leased.rows[0])
      throw new Error('Task lease is missing, expired, or owned by another worker');
    const activity = await db.query(
      `SELECT id FROM research.agent_activities WHERE id=$1 AND run_id=$2 AND actor_id=$3 AND ended_at IS NULL AND frontier_task_id=$4 AND frontier_attempt=$5`,
      [
        lease.activityId,
        lease.runId,
        lease.workerId,
        lease.task.frontier.id,
        leased.rows[0].attempt_count,
      ],
    );
    if (!activity.rows[0]) throw new Error('Activity does not belong to this worker and run');
    const plan = await readPlan(db, lease.runId);
    const spec = plan.tasks.find((task) => task.frontier.id === lease.task.frontier.id)!;
    const policy = plan.profile.modelPolicies.find(
      (candidate) => candidate.mode === plan.run.mode,
    )!;
    const workerInput =
      spec.input.executor === 'builtin' ? assertContract('ResearchWorkerInput', spec.input) : null;
    const deterministicStep =
      workerInput !== null &&
      (workerInput.operation !== 'synthesize' || workerInput.model === null);
    if (plan.run.mode !== 'deterministic' && !deterministicStep && !model && !executionFailure)
      throw new Error('Model provenance is required for this execution mode');
    if (model && policy.requiresBenchmark)
      throw new Error('A recorded benchmark admission is required before model execution');
    let output: unknown;
    let error: string | undefined;
    try {
      if (executionFailure) throw new Error(executionFailure);
      if (model && !policy.modelIds.includes(model.modelId))
        throw new Error('Model is not admitted by this run profile');
      output = assertContract(spec.outputContract, JSON.parse(rawOutput));
      if (spec.outputContract === 'ResearchAcquisitionResult') {
        const acquisition = assertContract('ResearchAcquisitionResult', output);
        for (const source of acquisition.sources) {
          const decision = assertContract(
            'PreservationDecision',
            source.rawRecord.preservationDecision,
          );
          if (
            !decision.allowTextRetention ||
            !source.cites.includes(decision.sourceUrl) ||
            Date.parse(decision.expiresAt) <= Date.now()
          )
            throw new Error('Acquired text requires current permission for its exact source');
        }
      }
      if (spec.outputContract === 'ResearchSearchResult') {
        const previous = await db.query(
          `SELECT artifact.extensions->'output' AS output FROM research.frontier_tasks task
          JOIN research.artifacts artifact ON artifact.id=task.result_artifact_id
          WHERE task.run_id=$1 AND task.output_contract='ResearchSearchResult'`,
          [lease.runId],
        );
        const urls = new Set<string>();
        for (const value of [...previous.rows.map((row) => row.output), output]) {
          for (const lead of assertContract('ResearchSearchResult', value).leads)
            urls.add(lead.url);
        }
        if (urls.size > plan.profile.budgets[plan.budgetClass].candidateUrls)
          throw new Error('Candidate URL budget exceeded');
      }

      if (
        spec.outputContract === 'SubjectExtraction' ||
        spec.outputContract === 'RelationshipHypothesisExtraction' ||
        spec.outputContract === 'ResearchTaskReport'
      ) {
        const sources: HarnessRawSubject[] = [];
        if (spec.input.source)
          sources.push(assertContract('HarnessSourceRecord', spec.input.source));
        if (Array.isArray(spec.input.sources)) {
          for (const source of spec.input.sources)
            sources.push(assertContract('HarnessSourceRecord', source));
        }
        const captured = await db.query(
          `SELECT artifact.extensions->'output' AS output
          FROM research.frontier_task_dependencies dependency
          JOIN research.frontier_tasks parent ON parent.id=dependency.depends_on_task_id
          JOIN research.artifacts artifact ON artifact.id=parent.result_artifact_id
          WHERE dependency.task_id=$1 AND parent.output_contract IN ('HarnessSourceRecord','ResearchAcquisitionResult')`,
          [spec.frontier.id],
        );
        for (const source of captured.rows) {
          const value = source.output as Record<string, unknown>;
          if (Array.isArray(value.sources))
            sources.push(...assertContract('ResearchAcquisitionResult', value).sources);
          else sources.push(assertContract('HarnessSourceRecord', value));
        }
        for (const source of sources) {
          if (source.rawRecord.preservationDecision) {
            const decision = assertContract(
              'PreservationDecision',
              source.rawRecord.preservationDecision,
            );
            if (!decision.allowTextRetention || Date.parse(decision.expiresAt) <= Date.now())
              throw new Error('Source retention permission expired before synthesis');
          }
        }
        if (spec.outputContract === 'SubjectExtraction') {
          const extraction = assertContract('SubjectExtraction', output);
          for (const claim of extraction.claims) assertQuoteAttached(claim.evidence, sources);
          if (new Set(extraction.claims.map((claim) => claim.id)).size !== extraction.claims.length)
            throw new Error('Duplicate claim identity');
          if (
            !extraction.claims.length &&
            (extraction.publicSummary || extraction.historicalContext)
          )
            throw new Error('Prose requires attached evidence');
        } else {
          for (const quote of assertContract(
            spec.outputContract === 'ResearchTaskReport'
              ? 'ResearchTaskReport'
              : 'RelationshipHypothesisExtraction',
            output,
          ).evidence)
            assertQuoteAttached(quote, sources);
        }
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    if (model) {
      const invocation = assertContract('ModelInvocation', {
        ...model,
        schemaVersion: '1.0.0',
        id: randomUUID(),
        activityId: lease.activityId,
        outputSchemaId: spec.outputContract,
        outputSchemaVersion: '1.0.0',
        rawResponse: rawOutput,
        status: error ? 'invalid' : 'valid',
        repairOfInvocationId: null,
      });
      await writeModelInvocation(db, invocation, { tier: plan.run.mode });
      await db.query(
        "UPDATE research.agent_activities SET actor_type='model',model_family=$2 WHERE id=$1",
        [lease.activityId, model.modelFamily],
      );
      if (error)
        await db.query(
          `INSERT INTO research.model_output_quarantine
        (id,invocation_id,raw_output,validation_errors,retention_until)
        VALUES ($1,$2,$3,$4,clock_timestamp()+make_interval(days=>$5))`,
          [
            randomUUID(),
            invocation.id,
            rawOutput,
            [error],
            plan.profile.retention.failedModelPayloadDays,
          ],
        );
    }
    const artifactId = randomUUID();
    const inheritedRetention = await db.query(
      `SELECT artifact.retention_source_urls,artifact.retention_until,artifact.payload_disposed_at
       FROM research.frontier_task_dependencies dependency
       JOIN research.frontier_tasks parent ON parent.id=dependency.depends_on_task_id
       JOIN research.artifacts artifact ON artifact.id=parent.result_artifact_id WHERE dependency.task_id=$1`,
      [spec.frontier.id],
    );
    if (
      inheritedRetention.rows.some(
        (row) =>
          row.payload_disposed_at ||
          (row.retention_until && new Date(String(row.retention_until)).getTime() <= Date.now()),
      )
    )
      throw new Error('A source dependency was withdrawn or expired');
    const sourceUrls = new Set<string>();
    let retentionUntil =
      Date.now() +
      (error
        ? plan.profile.retention.failedModelPayloadDays
        : plan.profile.retention.deadLetterDraftDays) *
        86_400_000;
    for (const row of inheritedRetention.rows) {
      for (const url of row.retention_source_urls as string[]) sourceUrls.add(url);
      if (row.retention_until)
        retentionUntil = Math.min(retentionUntil, new Date(String(row.retention_until)).getTime());
    }
    if (!error && spec.outputContract === 'ResearchAcquisitionResult') {
      for (const source of assertContract('ResearchAcquisitionResult', output).sources) {
        const decision = assertContract(
          'PreservationDecision',
          source.rawRecord.preservationDecision,
        );
        sourceUrls.add(decision.sourceUrl);
        retentionUntil = Math.min(retentionUntil, Date.parse(decision.expiresAt));
      }
    }
    await db.query(
      `INSERT INTO research.artifacts
      (id,run_id,activity_id,artifact_type,content_hash,schema_id,schema_version,storage_uri,extensions,status,idempotency_key,retention_source_urls,retention_until)
      VALUES ($1,$2,$3,'task-proposal',$4,$5,'1.0.0',$6,$7::jsonb,$8,$9,$10,$11)`,
      [
        artifactId,
        lease.runId,
        lease.activityId,
        sha256Bytes(rawOutput).digest,
        spec.outputContract,
        `postgres:research.artifacts/${artifactId}`,
        JSON.stringify({
          leaseTokenHash: sha256Bytes(lease.leaseToken).digest,
          ...(error ? { rawOutput, error } : { output }),
        }),
        error || spec.outputContract === 'RelationshipHypothesisExtraction'
          ? 'quarantined'
          : 'proposed',
        `task-result:${spec.frontier.id}:${leased.rows[0].attempt_count}`,
        [...sourceUrls],
        new Date(retentionUntil).toISOString(),
      ],
    );
    if (!error) {
      await db.query('UPDATE research.frontier_tasks SET result_artifact_id=$2 WHERE id=$1', [
        spec.frontier.id,
        artifactId,
      ]);
      await db.query(
        `INSERT INTO research.artifact_dependencies (artifact_id,used_artifact_id)
        SELECT $1,parent.result_artifact_id FROM research.frontier_task_dependencies dependency
        JOIN research.frontier_tasks parent ON parent.id=dependency.depends_on_task_id WHERE dependency.task_id=$2`,
        [artifactId, spec.frontier.id],
      );
    }
    await db.query('SELECT research.finish_frontier_task($1,$2,$3,$4,$5)', [
      spec.frontier.id,
      lease.workerId,
      lease.leaseToken,
      !error,
      error ?? null,
    ]);
    await db.query('UPDATE research.agent_activities SET ended_at=clock_timestamp() WHERE id=$1', [
      lease.activityId,
    ]);
    if (
      model?.accounting.costUsd !== null &&
      model?.accounting.costUsd !== undefined &&
      model.accounting.costUsd > spec.maxCostUsdPerAttempt
    ) {
      await db.query(
        "UPDATE research.runs SET status='escalated',completed_at=clock_timestamp(),terminal_reason='reported_charge_exceeded_reserved_bound' WHERE id=$1",
        [lease.runId],
      );
    }
    await reconcileRun(db, lease.runId);
    return { valid: !error, artifactId, ...(error ? { error } : {}) };
  });
}

async function reconcileRun(db: ExecutionClient, runId: string): Promise<void> {
  await db.query('SELECT id FROM research.runs WHERE id=$1 FOR UPDATE', [runId]);
  await db.query(
    `WITH RECURSIVE blocked(id) AS (
    SELECT id FROM research.frontier_tasks WHERE run_id=$1 AND status IN ('dead_letter','cancelled')
    UNION SELECT dependency.task_id FROM research.frontier_task_dependencies dependency
      JOIN blocked ON blocked.id=dependency.depends_on_task_id WHERE dependency.run_id=$1
  ) UPDATE research.frontier_tasks SET status='cancelled',last_error='A required dependency failed'
    WHERE run_id=$1 AND status IN ('pending','failed') AND id IN (SELECT id FROM blocked)`,
    [runId],
  );
  await db.query(
    `UPDATE research.runs run SET
    status=CASE WHEN run.deadline_at <= clock_timestamp() THEN 'escalated'
      WHEN EXISTS (SELECT 1 FROM research.frontier_tasks WHERE run_id=$1 AND status <> 'completed') THEN 'failed'
      ELSE 'succeeded' END,
    completed_at=clock_timestamp(),
    terminal_reason=CASE WHEN run.deadline_at <= clock_timestamp() THEN 'deadline_reached_with_unreviewed_evidence'
      WHEN EXISTS (SELECT 1 FROM research.frontier_tasks WHERE run_id=$1 AND status <> 'completed') THEN 'task_failure'
      ELSE 'execution_finished_independent_evidence_review_required' END
    WHERE run.id=$1 AND run.status IN ('pending','running') AND (
      run.deadline_at <= clock_timestamp() OR NOT EXISTS (
        SELECT 1 FROM research.frontier_tasks WHERE run_id=$1 AND status IN ('pending','leased','failed')
      ))`,
    [runId],
  );
}

/** Reports work status separately from evidence review; exhaustion never implies historical completeness. */
export async function researchExecutionStatus(
  pool: ExecutionPool,
  runId: string,
): Promise<Record<string, unknown>> {
  return transaction(pool, async (db) => {
    const run = await db.query(
      `SELECT id,status,reserved_cost_usd,max_cost_usd,deadline_at,terminal_reason,
      (SELECT sum(invocation.cost_usd) FROM research.model_invocations invocation JOIN research.agent_activities activity ON activity.id=invocation.activity_id WHERE activity.run_id=run.id) AS known_cost_usd,
      (SELECT count(*) FROM research.model_invocations invocation JOIN research.agent_activities activity ON activity.id=invocation.activity_id WHERE activity.run_id=run.id AND invocation.accounting_incomplete) AS incomplete_accounting_count
      FROM research.runs run WHERE id=$1`,
      [runId],
    );
    if (!run.rows[0]) throw new Error('Unknown research run');
    const tasks = await db.query(
      `SELECT id,task_type,status,attempt_count,max_attempts,leased_until,last_error,result_artifact_id
      FROM research.frontier_tasks WHERE run_id=$1 ORDER BY id`,
      [runId],
    );
    const needs = await db.query(
      `SELECT DISTINCT need.id,need.description,need.mandatory,need.contradiction_search,need.status
      FROM research.evidence_needs need JOIN research.frontier_tasks task ON task.evidence_need_id=need.id WHERE task.run_id=$1 ORDER BY need.id`,
      [runId],
    );
    return {
      run: run.rows[0],
      tasks: tasks.rows,
      evidenceNeeds: needs.rows,
      publicationAuthorized: false,
    };
  });
}
