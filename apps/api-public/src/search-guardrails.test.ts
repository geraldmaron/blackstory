/**
 * Public API search guardrail tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPublicSearchGuard,
  isPublicSearchPath,
  parsePublicSearchQuery,
} from './search-guardrails.ts';

test('isPublicSearchPath matches GET /v1/search routes only', () => {
  assert.equal(isPublicSearchPath('/v1/search', 'GET'), true);
  assert.equal(isPublicSearchPath('/v1/search/extra', 'GET'), true);
  assert.equal(isPublicSearchPath('/v1/entities', 'GET'), false);
  assert.equal(isPublicSearchPath('/v1/search', 'POST'), false);
});

test('parsePublicSearchQuery maps allowlisted params to structured input', () => {
  const parsed = parsePublicSearchQuery({
    q: ' tubman ',
    kind: 'person',
    state: 'NY',
    pageSize: '25',
    lat: '40.7128',
    lng: '-74.0060',
    radiusM: '5000',
  });

  assert.equal(parsed.q, ' tubman ');
  assert.deepEqual(parsed.filters, { kind: 'person', state: 'NY' });
  assert.equal(parsed.pageSize, 25);
  assert.equal(parsed.lat, 40.7128);
});

test('parsePublicSearchQuery accepts an era filter already in bucket form', () => {
  const parsed = parsePublicSearchQuery({ q: 'school', era: '1950s' });
  assert.deepEqual(parsed.filters, { era: '1950s' });
});

test('parsePublicSearchQuery normalizes a bare decade to the same bucket vocabulary the web deep link uses', () => {
  const parsed = parsePublicSearchQuery({ q: 'school', era: '1950' });
  assert.deepEqual(parsed.filters, { era: '1950s' });
});

test('parsePublicSearchQuery drops an era value that is not a valid decade bucket, rather than denying the request', () => {
  const parsed = parsePublicSearchQuery({ q: 'school', era: 'not-a-decade' });
  assert.deepEqual(parsed.filters, undefined);
});

test('parsePublicSearchQuery treats era=all as no narrowing, matching the shared discovery vocabulary', () => {
  const parsed = parsePublicSearchQuery({ q: 'school', era: 'all' });
  assert.deepEqual(parsed.filters, undefined);
});

test('public search guard allows canonical GET /v1/search', () => {
  const guard = createPublicSearchGuard();
  const decision = guard.evaluate({
    method: 'GET',
    path: '/v1/search',
    query: { q: 'harriet tubman', kind: 'person', pageSize: '20' },
  });

  assert.ok(decision);
  assert.equal(decision.endpointClass, 'search');
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    const meta = guard.endpointMetadata(decision);
    assert.equal(meta.endpointClass, 'search');
    assert.equal(meta.costTier, 'expensive_read');
  }
});

test('public search guard carries an era filter through to the canonical query', () => {
  const guard = createPublicSearchGuard();
  const decision = guard.evaluate({
    method: 'GET',
    path: '/v1/search',
    query: { q: 'school', era: '1950s' },
  });

  assert.ok(decision);
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.deepEqual([...decision.canonical.filters], [{ field: 'era', value: '1950s' }]);
  }
});

test('public search guard denies wildcard-only q with 400 payload', () => {
  const guard = createPublicSearchGuard();
  const decision = guard.evaluate({
    method: 'GET',
    path: '/v1/search',
    query: { q: '***' },
  });

  assert.ok(decision);
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    const response = guard.formatDeniedResponse(decision);
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'invalid_search_query');
    assert.equal(response.body.reason, 'wildcard_only');
  }
});

test('public search guard skips non-search paths', () => {
  const guard = createPublicSearchGuard();
  assert.equal(
    guard.evaluate({ method: 'GET', path: '/v1/entities/person-1', query: { q: 'test' } }),
    null,
  );
});

test('public search guard enforces export limits', () => {
  const guard = createPublicSearchGuard();
  const decision = guard.evaluate({
    method: 'GET',
    path: '/v1/search',
    query: { q: 'export me' },
    forExport: true,
    exportCount: 10_000,
  });

  assert.ok(decision);
  assert.equal(decision.allowed, false);
});
