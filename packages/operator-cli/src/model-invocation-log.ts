/** Canonical model invocation persistence and reports with explicit accounting gaps. */
import { randomUUID } from 'node:crypto';
import { assertContract, type ModelInvocation } from '@repo/research-kernel';
import type { RoutedCompletion } from './model-routing.js';

export type QueryablePool = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ readonly rows: readonly Row[] }>;
};

/** Both durable workers and routed completions use this writer. */
export async function writeModelInvocation(
  pool: QueryablePool,
  value: ModelInvocation,
  routing: { lane?: string; tier?: string } = {},
): Promise<string> {
  const invocation = assertContract('ModelInvocation', value);
  const accounting = invocation.accounting;
  if ((accounting.costUsd === null) !== (accounting.source === null)) {
    throw new Error('A reported model charge requires its accounting source');
  }
  if (accounting.costUsd === null && !accounting.incomplete) {
    throw new Error('Missing charges cannot be marked as complete accounting');
  }
  await pool.query(
    `INSERT INTO research.model_invocations (
       id, activity_id, provider, model_id, model_family, provider_route, price_snapshot,
       prompt_hash, output_schema_id, output_schema_version, benchmark_version, raw_response,
       status, repair_of_invocation_id, lane, tier, prompt_tokens, completion_tokens,
       cost_usd, cost_source, accounting_incomplete
     ) VALUES (
       $1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
     )`,
    [
      invocation.id,
      invocation.activityId,
      invocation.provider,
      invocation.modelId,
      invocation.modelFamily,
      JSON.stringify(invocation.providerRoute),
      JSON.stringify(invocation.priceSnapshot),
      invocation.promptHash,
      invocation.outputSchemaId,
      invocation.outputSchemaVersion,
      invocation.benchmarkVersion,
      invocation.rawResponse,
      invocation.status,
      invocation.repairOfInvocationId,
      routing.lane ?? null,
      routing.tier ?? null,
      accounting.promptTokens,
      accounting.completionTokens,
      accounting.costUsd,
      accounting.source,
      accounting.incomplete,
    ],
  );
  return invocation.id;
}

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
  const provider = completion.servedBy ?? completion.provider;
  const supported = ['openrouter', 'ollama', 'openai', 'anthropic'];
  return writeModelInvocation(
    pool,
    {
      schemaVersion: '1.0.0',
      id: randomUUID(),
      activityId: input.activityId,
      provider: supported.includes(provider) ? (provider as ModelInvocation['provider']) : 'other',
      modelId: completion.modelId,
      modelFamily: completion.modelId.split('/')[0]!,
      providerRoute: {
        provider: completion.provider,
        servedBy: completion.servedBy,
        attempts: completion.attempts,
      },
      priceSnapshot: {},
      promptHash: input.promptHash,
      outputSchemaId: input.outputSchemaId,
      outputSchemaVersion: input.outputSchemaVersion,
      benchmarkVersion: input.benchmarkVersion,
      rawResponse: completion.content,
      status: input.status,
      repairOfInvocationId: input.repairOfInvocationId ?? null,
      accounting: completion.accounting ?? {
        promptTokens: completion.usage?.promptTokens ?? null,
        completionTokens: completion.usage?.completionTokens ?? null,
        costUsd: null,
        source: null,
        incomplete: true,
      },
    },
    { lane: completion.lane, tier: completion.tier },
  );
}

export type LaneSpendRow = {
  readonly lane: string | null;
  readonly modelId: string;
  readonly invocationCount: number;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly costUsd: number | null;
  readonly unpricedInvocationCount: number;
  readonly missingUsageCount: number;
  readonly incompleteAccountingCount: number;
};

/** Sums are known subtotals; missing observations are counted, never imputed as free work. */
export async function loadLaneModelSpend(
  pool: QueryablePool,
  options: { readonly since?: Date } = {},
): Promise<readonly LaneSpendRow[]> {
  const result = await pool.query(
    `SELECT lane, model_id, count(*) AS invocation_count,
       sum(prompt_tokens) AS prompt_tokens, sum(completion_tokens) AS completion_tokens,
       sum(cost_usd) AS cost_usd,
       count(*) FILTER (WHERE cost_usd IS NULL) AS unpriced_invocation_count,
       count(*) FILTER (WHERE prompt_tokens IS NULL OR completion_tokens IS NULL) AS missing_usage_count,
       count(*) FILTER (WHERE accounting_incomplete) AS incomplete_accounting_count
     FROM research.model_invocations
     WHERE ($1::timestamptz IS NULL OR created_at >= $1)
     GROUP BY lane, model_id ORDER BY cost_usd DESC NULLS LAST, lane, model_id`,
    [options.since ?? null],
  );
  const nullableNumber = (value: unknown): number | null => (value === null ? null : Number(value));
  return result.rows.map((row) => ({
    lane: row.lane as string | null,
    modelId: String(row.model_id),
    invocationCount: Number(row.invocation_count),
    promptTokens: nullableNumber(row.prompt_tokens),
    completionTokens: nullableNumber(row.completion_tokens),
    costUsd: nullableNumber(row.cost_usd),
    unpricedInvocationCount: Number(row.unpriced_invocation_count),
    missingUsageCount: Number(row.missing_usage_count),
    incompleteAccountingCount: Number(row.incomplete_accounting_count),
  }));
}

export function formatLaneSpendReport(rows: readonly LaneSpendRow[]): string {
  if (rows.length === 0) return 'No model_invocations rows found for the requested window.';
  const lines = [
    'lane\tmodel\tcalls\tknown_prompt_tokens\tknown_completion_tokens\tknown_cost_usd\tunpriced_calls\tmissing_usage_calls\tincomplete_accounting_calls',
  ];
  let totalCost: number | null = null;
  let incomplete = 0;
  for (const row of rows) {
    if (row.costUsd !== null) totalCost = (totalCost ?? 0) + row.costUsd;
    incomplete += row.incompleteAccountingCount;
    lines.push(
      [
        row.lane ?? '(none)',
        row.modelId,
        row.invocationCount,
        row.promptTokens ?? 'unknown',
        row.completionTokens ?? 'unknown',
        row.costUsd?.toFixed(4) ?? 'unknown',
        row.unpricedInvocationCount,
        row.missingUsageCount,
        row.incompleteAccountingCount,
      ].join('\t'),
    );
  }
  lines.push(
    `\nKNOWN cost_usd: ${totalCost?.toFixed(4) ?? 'unknown'}; incomplete accounting calls: ${incomplete}`,
  );
  return lines.join('\n');
}
