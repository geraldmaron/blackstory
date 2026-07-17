
/**
 * Tests for the real Gemini embedding provider request/response shaping only, via
 * an injected fake client. No network access or API key is used or required.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeminiEmbeddingProvider, type GeminiEmbedContentClient } from './gemini-provider.js';
import { EmbeddingProviderError } from './provider.js';

test('createGeminiEmbeddingProvider requests the configured model and outputDimensionality', async () => {
  let capturedParams: unknown;
  const client: GeminiEmbedContentClient = {
    models: {
      async embedContent(params) {
        capturedParams = params;
        return { embeddings: params.contents.map(() => ({ values: [1, 2, 3] })) };
      },
    },
  };

  const provider = createGeminiEmbeddingProvider({
    environment: { GEMINI_API_KEY: 'test-key' },
    outputDimensionality: 768,
    clientFactory: () => client,
  });

  const result = await provider.embed(['a', 'b']);
  assert.deepEqual(result, [
    [1, 2, 3],
    [1, 2, 3],
  ]);
  assert.deepEqual(capturedParams, {
    model: 'gemini-embedding-001',
    contents: ['a', 'b'],
    config: { outputDimensionality: 768, taskType: 'SEMANTIC_SIMILARITY' },
  });
});

test('createGeminiEmbeddingProvider throws a clear error when no API key is configured', async () => {
  const provider = createGeminiEmbeddingProvider({ environment: {} });
  await assert.rejects(provider.embed(['x']), EmbeddingProviderError);
});

test('createGeminiEmbeddingProvider never touches the client until embed() is called', () => {
  let constructed = false;
  createGeminiEmbeddingProvider({
    environment: { GEMINI_API_KEY: 'test-key' },
    clientFactory: () => {
      constructed = true;
      return { models: { embedContent: async () => ({ embeddings: [] }) } };
    },
  });
  assert.equal(constructed, false);
});

test('createGeminiEmbeddingProvider wraps a client error in EmbeddingProviderError', async () => {
  const client: GeminiEmbedContentClient = {
    models: {
      async embedContent() {
        throw new Error('boom');
      },
    },
  };
  const provider = createGeminiEmbeddingProvider({
    environment: { GEMINI_API_KEY: 'test-key' },
    clientFactory: () => client,
  });
  await assert.rejects(provider.embed(['x']), EmbeddingProviderError);
});

test('createGeminiEmbeddingProvider rejects a response with a mismatched embedding count', async () => {
  const client: GeminiEmbedContentClient = {
    models: {
      async embedContent() {
        return { embeddings: [{ values: [1] }] };
      },
    },
  };
  const provider = createGeminiEmbeddingProvider({
    environment: { GEMINI_API_KEY: 'test-key' },
    clientFactory: () => client,
  });
  await assert.rejects(provider.embed(['x', 'y']), EmbeddingProviderError);
});

test('createGeminiEmbeddingProvider returns an empty array for an empty batch without calling the client', async () => {
  let called = false;
  const provider = createGeminiEmbeddingProvider({
    environment: { GEMINI_API_KEY: 'test-key' },
    clientFactory: () => ({
      models: {
        async embedContent() {
          called = true;
          return { embeddings: [] };
        },
      },
    }),
  });
  const result = await provider.embed([]);
  assert.deepEqual(result, []);
  assert.equal(called, false);
});
