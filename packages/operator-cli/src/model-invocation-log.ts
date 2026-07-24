/**
 * Writes bb_research.model_invocations rows for calls made through model-routing.ts.
 * The table has been live since `20260721041950_research_kernel_ledger.sql` but had 0 rows —
 * nothing in the repo wrote to it (see `20260724184000_model_invocations_cost_columns.sql` for
 * the lane/tier/token/cost columns this logger populates).
 *
 * Requires a pre-existing `bb_research.agent_activities.id` (this module does not create
 * cases/runs/activities — that ledger-write chain is repo-atya's scope). Callers already inside
 * a case/run/activity context pass its activityId through; callers with no ledger context yet
 * (mock provider runs, unit tests, ad hoc CLI dry-runs) should skip logging entirely rather than
 * fabricate one.
 */
import { randomUUID } from 'node:crypto';
import type { RoutedCompletion } from './model-routing.js';

/**
 * Structural subset of `pg.Pool`/`pg.PoolClient` this module needs. Avoids a direct `pg` type
 * dependency (operator-cli depends on `@repo/data-access`, not `pg`, for its Postgres pool).
 */
export type QueryablePool = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly Row[] }>;
};

export type ModelInvocationLogInput = {
  readonly activityId: string;
  readonly promptHash: string;
  readonly outputSchemaId: string;
  readonly outputSchemaVersion: string;
  readonly benchmarkVersion: string;
  readonly status: 'pending' | 'valid' | 'invalid' | 'failed';
  readonly repairOfInvocationId?: string;
};

export async function logModelInvocation(
  pool: QueryablePool,
  completion: RoutedCompletion,
  input: ModelInvocationLogInput,
): Promise<string> {
  const id = randomUUID();
  const usage = completion.usage ?? { promptTokens: 0, completionTokens: 0 };
  await pool.query(
    `INSERT INTO bb_research.model_invocations (
       id, activity_id, provider, model_id, model_family, provider_route, price_snapshot,
       prompt_hash, output_schema_id, output_schema_version, benchmark_version, raw_response,
       status, repair_of_invocation_id, lane, tier, prompt_tokens, completion_tokens,
       cost_usd_estimate
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
     )`,
    [
      id,
      input.activityId,
      completion.provider,
      completion.modelId,
      completion.modelId.split('/')[0] ?? completion.provider,
      JSON.stringify({ servedBy: completion.servedBy, attempts: completion.attempts }),
      JSON.stringify({ promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }),
      input.promptHash,
      input.outputSchemaId,
      input.outputSchemaVersion,
      input.benchmarkVersion,
      completion.content,
      input.status,
      input.repairOfInvocationId ?? null,
      completion.lane,
      completion.tier,
      usage.promptTokens,
      usage.completionTokens,
      completion.costUsdEstimate,
    ],
  );
  return id;
}

export type LaneSpendRow = {
  readonly lane: string | null;
  readonly modelId: string;
  readonly invocationCount: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly costUsdEstimate: number;
};

/** Backs the `model-report` CLI command: spend grouped by lane then model. */
export async function loadLaneModelSpend(
  pool: QueryablePool,
  options: { readonly since?: Date } = {},
): Promise<readonly LaneSpendRow[]> {
  type SpendRow = {
    readonly lane: string | null;
    readonly model_id: string;
    readonly invocation_count: string;
    readonly prompt_tokens: string;
    readonly completion_tokens: string;
    readonly cost_usd_estimate: string;
  };
  const result = await pool.query<SpendRow>(
    `SELECT
       lane,
       model_id,
       count(*) AS invocation_count,
       coalesce(sum(prompt_tokens), 0) AS prompt_tokens,
       coalesce(sum(completion_tokens), 0) AS completion_tokens,
       coalesce(sum(cost_usd_estimate), 0) AS cost_usd_estimate
     FROM bb_research.model_invocations
     WHERE ($1::timestamptz IS NULL OR created_at >= $1)
     GROUP BY lane, model_id
     ORDER BY cost_usd_estimate DESC, lane, model_id`,
    [options.since ?? null],
  );
  return result.rows.map((row) => ({
    lane: row.lane,
    modelId: row.model_id,
    invocationCount: Number(row.invocation_count),
    promptTokens: Number(row.prompt_tokens),
    completionTokens: Number(row.completion_tokens),
    costUsdEstimate: Number(row.cost_usd_estimate),
  }));
}

export function formatLaneSpendReport(rows: readonly LaneSpendRow[]): string {
  if (rows.length === 0) return 'No model_invocations rows found for the requested window.';
  const lines = ['lane\tmodel\tcalls\tprompt_tokens\tcompletion_tokens\tcost_usd_estimate'];
  let totalCost = 0;
  for (const row of rows) {
    totalCost += row.costUsdEstimate;
    lines.push(
      `${row.lane ?? '(none)'}\t${row.modelId}\t${row.invocationCount}\t${row.promptTokens}\t` +
        `${row.completionTokens}\t${row.costUsdEstimate.toFixed(4)}`,
    );
  }
  lines.push(`\nTOTAL cost_usd_estimate: ${totalCost.toFixed(4)}`);
  return lines.join('\n');
}
