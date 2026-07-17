/**
 * Tests for the composed `find_nearest` endpoint every dependency is a fake or the
 * deterministic mock embedding provider, so this runs with no network access, no API key, and
 * no Firestore emulator.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppCheckDecision } from '@black-book/firebase';
import {
  createDeterministicMockEmbeddingProvider,
  createInMemoryVectorIndexStore,
  truncateAndNormalize,
  EMBEDDING_DIMS,
} from '@black-book/firebase';
import { createFindNearestEndpoint, type FindNearestHttpRequest } from './vector-search-endpoint.ts';

const ALLOWED_APP_CHECK: AppCheckDecision = {
  allowed: true,
  verified: true,
  mode: 'enforce',
  trustedService: false,
};

const DENIED_APP_CHECK: AppCheckDecision = {
  allowed: false,
  verified: false,
  mode: 'enforce',
  status: 401,
  code: 'APP_CHECK_REQUIRED',
  reason: 'missing_token',
  trustedService: false,
};

function baseRequest(overrides: Partial<FindNearestHttpRequest> = {}): FindNearestHttpRequest {
  return {
    method: 'GET',
    path: '/v1/search/nearest',
    query: { q: 'the school where the sit-ins started' },
    headers: {},
    subject: 'anonymous',
    clientIp: '203.0.113.1',
    ...overrides,
  };
}

test('find_nearest denies with 401 when App Check fails', async () => {
  const endpoint = createFindNearestEndpoint({
    appCheckGuard: async () => DENIED_APP_CHECK,
    embeddingProvider: createDeterministicMockEmbeddingProvider(),
    vectorStore: createInMemoryVectorIndexStore(),
    loadKillSwitchSnapshot: () => ({}),
  });

  const response = await endpoint.handle(baseRequest());
  assert.equal(response.status, 401);
});

test('find_nearest denies with 403 when the search kill switch is engaged', async () => {
  const endpoint = createFindNearestEndpoint({
    appCheckGuard: async () => ALLOWED_APP_CHECK,
    embeddingProvider: createDeterministicMockEmbeddingProvider(),
    vectorStore: createInMemoryVectorIndexStore(),
    loadKillSwitchSnapshot: () => ({ search: { id: 'search', enabled: true } }),
  });

  const response = await endpoint.handle(baseRequest());
  assert.equal(response.status, 403);
});

test('find_nearest denies with 400 on an empty query', async () => {
  const endpoint = createFindNearestEndpoint({
    appCheckGuard: async () => ALLOWED_APP_CHECK,
    embeddingProvider: createDeterministicMockEmbeddingProvider(),
    vectorStore: createInMemoryVectorIndexStore(),
    loadKillSwitchSnapshot: () => ({}),
  });

  const response = await endpoint.handle(baseRequest({ query: {} }));
  assert.equal(response.status, 400);
});

test('find_nearest denies with 429 once the anonymous/search token bucket is exhausted', async () => {
  const endpoint = createFindNearestEndpoint({
    appCheckGuard: async () => ALLOWED_APP_CHECK,
    embeddingProvider: createDeterministicMockEmbeddingProvider(),
    vectorStore: createInMemoryVectorIndexStore(),
    loadKillSwitchSnapshot: () => ({}),
  });

  const statuses: number[] = [];
  // anonymous/search token bucket capacity is 8 (packages/security/src/rate-limits.ts) the
  // 9th sequential request from the same subject/IP must be denied.
  for (let i = 0; i < 9; i += 1) {
    const response = await endpoint.handle(baseRequest({ query: { q: `query number ${i}` } }));
    statuses.push(response.status);
  }
  assert.equal(statuses.at(-1), 429);
  assert.ok(statuses.slice(0, 8).every((status) => status !== 429));
});

test('find_nearest returns ranked matches and echoes canonical k/distanceThreshold on success', async () => {
  const provider = createDeterministicMockEmbeddingProvider();
  const store = createInMemoryVectorIndexStore();

  const queryText = 'the school where the sit-ins started';
  const [rawVector] = await provider.embed([queryText]);
  const vector = truncateAndNormalize(rawVector!, EMBEDDING_DIMS);

  await store.writeEmbedding({
    entityId: 'entity-greensboro-a-and-t',
    kind: 'school',
    state: 'NC',
    vector,
    dims: EMBEDDING_DIMS,
    model: provider.model,
    sourceTextHash: 'irrelevant-for-this-test',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const endpoint = createFindNearestEndpoint({
    appCheckGuard: async () => ALLOWED_APP_CHECK,
    embeddingProvider: provider,
    vectorStore: store,
    loadKillSwitchSnapshot: () => ({}),
  });

  const response = await endpoint.handle(
    baseRequest({ query: { q: queryText, kind: 'school', distanceThreshold: '0.9' } }),
  );

  assert.equal(response.status, 200);
  if (response.status === 200) {
    assert.equal(response.body.k, 20);
    assert.equal(response.body.distanceThreshold, 0.9);
    assert.deepEqual(
      response.body.matches.map((match) => match.entityId),
      ['entity-greensboro-a-and-t'],
    );
    assert.ok(response.body.matches[0]!.distance >= 0.9);
  }
});
