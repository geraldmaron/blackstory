/**
 * Unit tests for model_invocations write/report helpers, against a fake pg.Pool so no live
 * Postgres is required (mirrors worker-preflight.test.ts's `queryDatabase` fake pattern).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatLaneSpendReport,
  loadLaneModelSpend,
  logModelInvocation,
} from './model-invocation-log.ts';
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
    accounting: {
      promptTokens: 120,
      completionTokens: 45,
      costUsd: 0.00123,
      source: 'provider-response',
      incomplete: false,
    },
    lane: 'editorial-enrichment',
    tier: 'free-batch',
    costUsd: 0.00123,
  };
  const id = await logModelInvocation(pool, completion, {
    activityId: 'activity-1',
    promptHash: 'a'.repeat(64),
    outputSchemaId: 'editorial.decision.v1',
    outputSchemaVersion: '1.0.0',
    benchmarkVersion: '1.0.0',
    status: 'valid',
  });
  assert.equal(queries.length, 1);
  assert.match(queries[0]!.text, /INSERT INTO research\.model_invocations/);
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
            cost_usd: '1.234500',
            unpriced_invocation_count: '1',
            missing_usage_count: '1',
            incomplete_accounting_count: '1',
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
      costUsd: 1.2345,
      unpricedInvocationCount: 1,
      missingUsageCount: 1,
      incompleteAccountingCount: 1,
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
      costUsd: 0.5,
      unpricedInvocationCount: 1,
      missingUsageCount: 1,
      incompleteAccountingCount: 1,
    },
  ]);
  assert.match(report, /story-craft/);
  assert.match(report, /KNOWN cost_usd: 0\.5000/);
});

test('unknown provider usage stays NULL and an all-unknown report cannot report zero spend', async () => {
  const queries: { text: string; values: unknown[] }[] = [];
  await logModelInvocation(
    fakePool(queries),
    {
      content: '{}',
      provider: 'other',
      modelId: 'unlisted-model',
      lane: 'story-craft',
      tier: 'quality-prose',
      costUsd: null,
    },
    {
      activityId: 'activity-1',
      promptHash: 'b'.repeat(64),
      outputSchemaId: 'ResearchTaskReport',
      outputSchemaVersion: '1.0.0',
      benchmarkVersion: 'unassessed',
      status: 'valid',
    },
  );
  assert.deepEqual(queries[0]!.values.slice(16), [null, null, null, null, true]);
  assert.match(
    formatLaneSpendReport([
      {
        lane: null,
        modelId: 'unlisted-model',
        invocationCount: 1,
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        unpricedInvocationCount: 1,
        missingUsageCount: 1,
        incompleteAccountingCount: 1,
      },
    ]),
    /KNOWN cost_usd: unknown; incomplete accounting calls: 1/,
  );
});
