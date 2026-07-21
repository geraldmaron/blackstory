import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWorkerPreflight } from './worker-preflight.ts';

const ENV = {
  DATABASE_URL: 'postgresql://example.invalid/postgres',
  RESEARCH_PROFILE_ID: 'black-history',
  RESEARCH_PROFILE_VERSION: '1.0.0',
  RESEARCH_SCHEMA_VERSION: '1.0.0',
  SEARXNG_BASE_URL: 'http://searxng.invalid',
  OLLAMA_BASE_URL: 'http://ollama.invalid/v1',
  OLLAMA_MODEL: 'qwen3:8b',
  EDITORIAL_LLM_PROVIDER: 'hybrid',
  OPENROUTER_API_KEY: 'test-key',
};

const healthyFetch = (async (input: string | URL | Request) => {
  const url = String(input);
  return new Response(
    url.includes('/api/tags') ? JSON.stringify({ models: [{ name: 'qwen3:8b' }] }) : '{}',
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}) as typeof fetch;

test('worker preflight passes only when every canonical dependency is available', async () => {
  const report = await runWorkerPreflight({
    environment: ENV,
    fetch: healthyFetch,
    freeBytes: () => 10 * 1024 ** 3,
    queryDatabase: async () => ({
      frontierTasks: 'bb_research.frontier_tasks',
      researchRuns: 'bb_research.runs',
    }),
    now: () => new Date('2026-07-21T12:00:00.000Z'),
  });
  assert.equal(report.ok, true);
  assert.ok(report.checks.every((check) => check.ok));
});

test('worker preflight fails closed for missing credentials and policy versions', async () => {
  const report = await runWorkerPreflight({
    environment: { EDITORIAL_LLM_PROVIDER: 'hybrid' },
    fetch: (async () => new Response('{}', { status: 503 })) as typeof fetch,
    freeBytes: () => 1,
  });
  assert.equal(report.ok, false);
  assert.equal(report.checks.find((check) => check.name === 'postgres-credentials')?.ok, false);
  assert.equal(report.checks.find((check) => check.name === 'profile-version')?.ok, false);
  assert.equal(report.checks.find((check) => check.name === 'openrouter-credentials')?.ok, false);
});
