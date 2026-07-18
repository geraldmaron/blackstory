/**
 * Tests for `/v1/search/nearest` guardrails the shared text/filter layer
 * plus the vector-specific distanceThreshold/eraBucket/k bounds.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_DISTANCE_THRESHOLD,
  MAX_VECTOR_SEARCH_K,
  evaluateVectorSearchGuardrails,
  formatVectorSearchGuardDeniedResponse,
  isVectorSearchPath,
} from './vector-search-guardrails.ts';

test('isVectorSearchPath matches GET /v1/search/nearest only', () => {
  assert.equal(isVectorSearchPath('/v1/search/nearest', 'GET'), true);
  assert.equal(isVectorSearchPath('/v1/search/nearest/', 'GET'), true);
  assert.equal(isVectorSearchPath('/v1/search', 'GET'), false);
  assert.equal(isVectorSearchPath('/v1/search/nearest', 'POST'), false);
});

test('evaluateVectorSearchGuardrails allows a well-formed query with defaults', () => {
  const decision = evaluateVectorSearchGuardrails({
    method: 'GET',
    path: '/v1/search/nearest',
    query: { q: 'the school where the sit-ins started' },
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.canonical.queryText, 'the school where the sit-ins started');
    assert.equal(decision.canonical.distanceThreshold, DEFAULT_DISTANCE_THRESHOLD);
    assert.equal(decision.canonical.k, 20); // DEFAULT_QUERY_GUARDRAIL_LIMITS.defaultPageSize
  }
});

test('evaluateVectorSearchGuardrails maps k onto the shared pageSize cap', () => {
  const withinCap = evaluateVectorSearchGuardrails({
    method: 'GET',
    path: '/v1/search/nearest',
    query: { q: 'sit-ins', k: String(MAX_VECTOR_SEARCH_K) },
  });
  assert.equal(withinCap.allowed, true);

  const overCap = evaluateVectorSearchGuardrails({
    method: 'GET',
    path: '/v1/search/nearest',
    query: { q: 'sit-ins', k: String(MAX_VECTOR_SEARCH_K + 1) },
  });
  assert.equal(overCap.allowed, false);
  if (!overCap.allowed) {
    assert.equal(overCap.reason, 'page_size_exceeded');
  }
});

test('evaluateVectorSearchGuardrails requires a non-empty q even when filters are present', () => {
  const decision = evaluateVectorSearchGuardrails({
    method: 'GET',
    path: '/v1/search/nearest',
    query: { kind: 'school' },
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, 'empty_query');
  }
});

test('evaluateVectorSearchGuardrails validates kind/state through the shared filter allowlist', () => {
  const decision = evaluateVectorSearchGuardrails({
    method: 'GET',
    path: '/v1/search/nearest',
    query: { q: 'sit-ins', kind: 'school', state: 'nc' },
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.canonical.kind, 'school');
    assert.equal(decision.canonical.state, 'nc'.toLowerCase());
  }
});

test('evaluateVectorSearchGuardrails rejects an out-of-range distanceThreshold', () => {
  const decision = evaluateVectorSearchGuardrails({
    method: 'GET',
    path: '/v1/search/nearest',
    query: { q: 'sit-ins', distanceThreshold: '2.5' },
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, 'distance_threshold_invalid');
  }
});

test('evaluateVectorSearchGuardrails accepts a valid distanceThreshold and eraBucket', () => {
  const decision = evaluateVectorSearchGuardrails({
    method: 'GET',
    path: '/v1/search/nearest',
    query: { q: 'sit-ins', distanceThreshold: '0.7', eraBucket: '1960s' },
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.equal(decision.canonical.distanceThreshold, 0.7);
    assert.equal(decision.canonical.eraBucket, '1960s');
  }
});

test('evaluateVectorSearchGuardrails rejects an eraBucket that is too long', () => {
  const decision = evaluateVectorSearchGuardrails({
    method: 'GET',
    path: '/v1/search/nearest',
    query: { q: 'sit-ins', eraBucket: 'a'.repeat(64) },
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, 'era_bucket_invalid');
  }
});

test('formatVectorSearchGuardDeniedResponse returns a stable 400 payload', () => {
  const decision = evaluateVectorSearchGuardrails({
    method: 'GET',
    path: '/v1/search/nearest',
    query: {},
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    const response = formatVectorSearchGuardDeniedResponse(decision);
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'invalid_vector_search_query');
  }
});
