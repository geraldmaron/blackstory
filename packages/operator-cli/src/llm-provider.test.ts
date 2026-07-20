/**
 * Unit tests for LLM content extraction, hybrid failover, and retryable empty responses.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHybridLlmProvider,
  createOllamaLlmProvider,
  extractMessageContent,
} from './llm-provider.ts';
import { runEditorialJudge } from './editorial-run.ts';

test('extractMessageContent prefers content over reasoning', () => {
  assert.equal(
    extractMessageContent({ content: '{"ok":true}', reasoning: 'ignore me' }),
    '{"ok":true}',
  );
});

test('extractMessageContent pulls JSON from reasoning when content empty', () => {
  const reasoning = 'thinking… {"decision":"keep","rationale":"x"} trailing';
  assert.equal(extractMessageContent({ content: '', reasoning }), '{"decision":"keep","rationale":"x"}');
});

test('hybrid fails over to ollama when openrouter returns retryable error', async () => {
  let openrouterCalls = 0;
  let ollamaCalls = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('openrouter.ai')) {
      openrouterCalls += 1;
      return new Response('rate limited', { status: 429 });
    }
    if (url.includes('/api/chat')) {
      ollamaCalls += 1;
      return Response.json({
        model: 'qwen3:8b',
        message: {
          role: 'assistant',
          content: JSON.stringify({
            decision: 'keep',
            rationale: 'ollama failover',
            confidence: 0.6,
            drafts: { publicSummary: 'A'.repeat(140) },
          }),
        },
      });
    }
    throw new Error(`unexpected fetch ${url} ${init?.method ?? ''}`);
  };

  const provider = createHybridLlmProvider({
    apiKey: 'test-key',
    fetchImpl,
    maxAttempts: 1,
    ollamaModel: 'qwen3:8b',
  });
  const result = await provider.complete({
    model: 'openrouter/free',
    messages: [{ role: 'user', content: 'hi' }],
  });
  assert.equal(result.provider, 'hybrid');
  assert.equal(result.servedBy, 'ollama');
  assert.equal(openrouterCalls, 1);
  assert.equal(ollamaCalls, 1);
  assert.match(result.content, /ollama failover/);
});

test('ollama native provider uses /api/chat', async () => {
  let hitNative = false;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    assert.match(url, /\/api\/chat$/);
    hitNative = true;
    return Response.json({
      model: 'qwen3:8b',
      message: { role: 'assistant', content: '{"ok":true}' },
    });
  };
  const provider = createOllamaLlmProvider({
    baseUrl: 'http://127.0.0.1:11434/v1',
    fetchImpl,
    maxAttempts: 1,
  });
  const result = await provider.complete({
    model: 'qwen3:8b',
    messages: [{ role: 'user', content: 'x' }],
  });
  assert.equal(hitNative, true);
  assert.equal(result.content, '{"ok":true}');
});

test('editorial concurrency isolates per-item failures', async () => {
  let calls = 0;
  const provider = {
    id: 'flaky',
    async complete() {
      calls += 1;
      if (calls === 2) throw new Error('boom');
      return {
        content: JSON.stringify({
          decision: 'keep',
          rationale: 'ok',
          confidence: 0.7,
          drafts: { publicSummary: 'A'.repeat(140) },
        }),
        provider: 'flaky',
        modelId: 'flaky-1',
      };
    },
  };
  const result = await runEditorialJudge({
    subjects: [
      { subjectId: 'a', title: 'Alpha Place' },
      { subjectId: 'b', title: 'Beta Place' },
      { subjectId: 'c', title: 'Gamma Place' },
    ],
    catalog: [
      { id: 'a', displayName: 'Alpha Place' },
      { id: 'b', displayName: 'Beta Place' },
      { id: 'c', displayName: 'Gamma Place' },
    ],
    identity: { operatorId: 'op', sessionId: 'sess', source: 'cli' },
    nowIso: '2026-07-19T00:00:00.000Z',
    provider,
    concurrency: 3,
  });
  assert.equal(result.concurrency, 3);
  assert.equal(result.items.length, 3);
  assert.equal(result.errorCount, 1);
  assert.equal(result.keepCount, 2);
  assert.equal(result.items[1]?.packet.decision, 'needs_evidence');
  assert.match(result.items[1]?.error ?? '', /boom/);
});

test('hybrid fails over when openrouter returns non-JSON content', async () => {
  let ollamaCalls = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('openrouter.ai')) {
      return Response.json({
        model: 'free-bad',
        choices: [{ message: { role: 'assistant', content: 'not json at all' } }],
      });
    }
    if (url.includes('/api/chat')) {
      ollamaCalls += 1;
      return Response.json({
        model: 'qwen3:8b',
        message: {
          role: 'assistant',
          content: JSON.stringify({
            decision: 'keep',
            rationale: 'json ok',
            confidence: 0.5,
            drafts: { publicSummary: 'A'.repeat(140) },
          }),
        },
      });
    }
    throw new Error(`unexpected ${url}`);
  };
  const provider = createHybridLlmProvider({
    apiKey: 'test-key',
    fetchImpl,
    maxAttempts: 1,
  });
  const result = await provider.complete({
    model: 'openrouter/free',
    messages: [{ role: 'user', content: 'hi' }],
  });
  assert.equal(result.servedBy, 'ollama');
  assert.equal(ollamaCalls, 1);
});

test('openrouter rotates through the model roster on retryable failures', async () => {
  const attemptedModels: string[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { model: string };
    attemptedModels.push(body.model);
    if (attemptedModels.length < 3) {
      return new Response('rate limited', { status: 429 });
    }
    return Response.json({
      model: body.model,
      choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }],
    });
  };
  const { createOpenRouterLlmProvider } = await import('./llm-provider.ts');
  const provider = createOpenRouterLlmProvider({
    apiKey: 'test-key',
    models: ['tencent/hy3:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'google/gemma-4-31b-it:free'],
    fetchImpl,
  });
  const result = await provider.complete({ model: '', messages: [{ role: 'user', content: 'x' }] });
  assert.deepEqual(attemptedModels, [
    'tencent/hy3:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
  ]);
  assert.equal(result.modelId, 'google/gemma-4-31b-it:free');
  assert.equal(result.attempts, 3);
});

test('openrouter keeps a caller-pinned model pinned across retries', async () => {
  const attemptedModels: string[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { model: string };
    attemptedModels.push(body.model);
    if (attemptedModels.length < 2) {
      return new Response('overloaded', { status: 503 });
    }
    return Response.json({
      model: body.model,
      choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }],
    });
  };
  const { createOpenRouterLlmProvider } = await import('./llm-provider.ts');
  const provider = createOpenRouterLlmProvider({
    apiKey: 'test-key',
    models: ['tencent/hy3:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
    fetchImpl,
  });
  const result = await provider.complete({
    model: 'openrouter/free',
    messages: [{ role: 'user', content: 'x' }],
  });
  assert.deepEqual(attemptedModels, ['openrouter/free', 'openrouter/free']);
  assert.equal(result.attempts, 2);
});

test('openrouter rotates to the next model even on a non-retryable error (e.g. 400 unsupported feature)', async () => {
  const attemptedModels: string[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { model: string };
    attemptedModels.push(body.model);
    if (body.model === 'tencent/hy3:free') {
      return new Response('unsupported response_format', { status: 400 });
    }
    return Response.json({
      model: body.model,
      choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }],
    });
  };
  const { createOpenRouterLlmProvider } = await import('./llm-provider.ts');
  const provider = createOpenRouterLlmProvider({
    apiKey: 'test-key',
    models: ['tencent/hy3:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
    fetchImpl,
  });
  const result = await provider.complete({ model: '', messages: [{ role: 'user', content: 'x' }] });
  assert.deepEqual(attemptedModels, ['tencent/hy3:free', 'nvidia/nemotron-3-super-120b-a12b:free']);
  assert.equal(result.modelId, 'nvidia/nemotron-3-super-120b-a12b:free');
});
