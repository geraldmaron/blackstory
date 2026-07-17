
/**
 * Tests for the embedding provider abstraction: retry/backoff and the deterministic mock
 * provider used by every other test in this instead of live network calls.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EmbeddingProviderError,
  createDeterministicMockEmbeddingProvider,
  createRetryingEmbeddingProvider,
  type EmbeddingProvider,
} from './provider.js';

test('createDeterministicMockEmbeddingProvider is deterministic per input text', async () => {
  const provider = createDeterministicMockEmbeddingProvider({ dims: 32 });
  const [first] = await provider.embed(['hello world']);
  const [second] = await provider.embed(['hello world']);
  assert.deepEqual(first, second);
  assert.equal(first!.length, 32);
});

test('createDeterministicMockEmbeddingProvider gives different texts different vectors', async () => {
  const provider = createDeterministicMockEmbeddingProvider({ dims: 32 });
  const [a, b] = await provider.embed(['alpha', 'beta']);
  assert.notDeepEqual(a, b);
});

test('createDeterministicMockEmbeddingProvider preserves input order for batches', async () => {
  const provider = createDeterministicMockEmbeddingProvider({ dims: 8 });
  const texts = ['one', 'two', 'three'];
  const vectors = await provider.embed(texts);
  const individually = await Promise.all(texts.map((text) => provider.embed([text])));
  vectors.forEach((vector, index) => {
    assert.deepEqual(vector, individually[index]![0]);
  });
});

function flakyProvider(failuresBeforeSuccess: number): { provider: EmbeddingProvider; calls: number[] } {
  const calls: number[] = [];
  let attempt = 0;
  return {
    calls,
    provider: {
      model: 'flaky',
      async embed(texts) {
        attempt += 1;
        calls.push(attempt);
        if (attempt <= failuresBeforeSuccess) {
          throw new Error(`simulated failure ${attempt}`);
        }
        return texts.map(() => [1, 0, 0]);
      },
    },
  };
}

test('createRetryingEmbeddingProvider retries and eventually succeeds', async () => {
  const { provider, calls } = flakyProvider(2);
  const sleeps: number[] = [];
  const retrying = createRetryingEmbeddingProvider(provider, {
    maxAttempts: 3,
    baseDelayMs: 10,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  const result = await retrying.embed(['x']);
  assert.deepEqual(result, [[1, 0, 0]]);
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [10, 20]);
});

test('createRetryingEmbeddingProvider throws EmbeddingProviderError after exhausting attempts', async () => {
  const { provider } = flakyProvider(5);
  const retrying = createRetryingEmbeddingProvider(provider, {
    maxAttempts: 2,
    baseDelayMs: 1,
    sleep: async () => {},
  });

  await assert.rejects(retrying.embed(['x']), EmbeddingProviderError);
});

test('createRetryingEmbeddingProvider rejects a non-positive maxAttempts', () => {
  assert.throws(
    () => createRetryingEmbeddingProvider({ model: 'm', embed: async () => [] }, { maxAttempts: 0 }),
    EmbeddingProviderError,
  );
});
