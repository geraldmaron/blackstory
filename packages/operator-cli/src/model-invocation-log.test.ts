/**
 * Unit tests for model_invocations write/report helpers, against a fake pg.Pool so no live
 * Postgres is required (mirrors worker-preflight.test.ts's `queryDatabase` fake pattern).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatLaneSpendReport, loadLaneModelSpend, logModelInvocation } from './model-invocation-log.ts';
import type { RoutedCompletion } from './model-routing.ts';

function fakePool(recordedQueries: { text: string; values: unknown[] }[]) {
  return {
    async query(text: string, values: unknown[] = []) {
      recordedQueries.push({ text, values });
      return { rows: [] };
    },
  };
}

test('logModelInvocation inserts a row with lane, tier, tokens, and cost', async () => {
  const queries: { text: string; values: unknown[] }[] = [];
  const pool = fakePool(queries);
  const completion: RoutedCompletion = {
    content: '{"decision":"keep"}',
    provider: 'openrouter',
    modelId: 'deepseek/deepseek-v3.2',
    usage: { promptTokens: 120, completionTokens: 45 },
    lane: 'editorial-enrichment',
    tier: 'free-batch',
    costUsdEstimate: 0.00123,
  };
  const id = await logModelInvocation(pool, completion, {
    activityId: 'activity-1',
    promptHash: 'hash-1',
    outputSchemaId: 'editorial.decision.v1',
    outputSchemaVersion: '1.0.0',
    benchmarkVersion: '1.0.0',
    status: 'valid',
  });
  assert.equal(queries.length, 1);
  assert.match(queries[0]!.text, /INSERT INTO bb_research\.model_invocations/);
  assert.equal(queries[0]!.values[0], id);
  assert.equal(queries[0]!.values[1], 'activity-1');
  assert.equal(queries[0]!.values[14], 'editorial-enrichment');
  assert.equal(queries[0]!.values[15], 'free-batch');
  assert.equal(queries[0]!.values[16], 120);
  assert.equal(queries[0]!.values[17], 45);
  assert.equal(queries[0]!.values[18], 0.00123);
});

test('loadLaneModelSpend maps numeric aggregate columns', async () => {
  const pool = {
    async query() {
      return {
        rows: [
          {
            lane: 'story-craft',
            model_id: 'moonshotai/kimi-k2.5',
            invocation_count: '3',
            prompt_tokens: '900',
            completion_tokens: '450',
            cost_usd_estimate: '1.234500',
          },
        ],
      };
    },
  };
  const rows = await loadLaneModelSpend(pool);
  assert.deepEqual(rows, [
    {
      lane: 'story-craft',
      modelId: 'moonshotai/kimi-k2.5',
      invocationCount: 3,
      promptTokens: 900,
      completionTokens: 450,
      costUsdEstimate: 1.2345,
    },
  ]);
});

test('formatLaneSpendReport renders a total line and handles the empty case', () => {
  assert.equal(
    formatLaneSpendReport([]),
    'No model_invocations rows found for the requested window.',
  );
  const report = formatLaneSpendReport([
    {
      lane: 'story-craft',
      modelId: 'moonshotai/kimi-k2.5',
      invocationCount: 2,
      promptTokens: 100,
      completionTokens: 50,
      costUsdEstimate: 0.5,
    },
  ]);
  assert.match(report, /story-craft/);
  assert.match(report, /TOTAL cost_usd_estimate: 0\.5000/);
});
