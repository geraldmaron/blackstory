import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EmbeddingProviderError } from '../../packages/ops-data/src/embeddings/provider.ts';
import {
  createOpenRouterEvaluationEmbeddingProvider,
  type OpenRouterEmbeddingUsage,
} from './openrouter-evaluation-embedding-provider.ts';

const model = 'openai/text-embedding-3-small';

function vector(value: number, dimensions = 3): number[] {
  return Array.from({ length: dimensions }, () => value);
}

test('batches inputs, restores indexed order, and preserves OpenRouter normalized model and usage', async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  let usage: OpenRouterEmbeddingUsage | undefined;
  const provider = createOpenRouterEvaluationEmbeddingProvider({
    apiKey: 'test-key',
    model,
    dimensions: 3,
    onUsage: (value) => {
      usage = value;
    },
    fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return Response.json({
        model: 'text-embedding-3-small',
        data: [
          { index: 1, embedding: vector(2) },
          { index: 0, embedding: vector(1) },
        ],
        usage: { prompt_tokens: 11, total_tokens: 11, cost: 0.00000022 },
      });
    },
  });

  assert.deepEqual(await provider.embed(['first', 'second']), [vector(1), vector(2)]);
  assert.equal(request?.url, 'https://openrouter.ai/api/v1/embeddings');
  assert.equal(request?.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    model,
    input: ['first', 'second'],
    dimensions: 3,
    encoding_format: 'float',
  });
  assert.equal((request?.init?.headers as Record<string, string>).authorization, 'Bearer test-key');
  assert.deepEqual(usage, {
    responseModel: 'text-embedding-3-small',
    promptTokens: 11,
    totalTokens: 11,
    costUsd: 0.00000022,
  });
});

test('rejects a response count or vector dimension that violates the provider contract', async () => {
  for (const data of [
    [{ index: 0, embedding: vector(1) }],
    [
      { index: 0, embedding: vector(1) },
      { index: 1, embedding: vector(2, 2) },
    ],
  ]) {
    const provider = createOpenRouterEvaluationEmbeddingProvider({
      apiKey: 'test-key',
      model,
      dimensions: 3,
      fetchImpl: async () => Response.json({ model, data }),
    });
    await assert.rejects(provider.embed(['first', 'second']), EmbeddingProviderError);
  }
});

test('rejects a response outside the explicit model normalization allowlist', async () => {
  const provider = createOpenRouterEvaluationEmbeddingProvider({
    apiKey: 'test-key',
    model,
    dimensions: 3,
    fetchImpl: async () =>
      Response.json({ model: 'other/model', data: [{ index: 0, embedding: vector(1) }] }),
  });
  await assert.rejects(provider.embed(['first']), /returned model/);
});

test('rejects malformed usage instead of recording uncertain accounting', async () => {
  const provider = createOpenRouterEvaluationEmbeddingProvider({
    apiKey: 'test-key',
    model,
    dimensions: 3,
    fetchImpl: async () =>
      Response.json({
        model,
        data: [{ index: 0, embedding: vector(1) }],
        usage: { prompt_tokens: -1 },
      }),
  });
  await assert.rejects(provider.embed(['first']), /usage\.prompt_tokens/);
});
