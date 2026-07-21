/**
 * Integration tests for the `/explore/api` refine route: request integrity, rate limits,
 * and `evaluateSearchQueryGuardrails` bound dynamic explore filter queries.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../../lib/web-security/csrf';
import { createExploreRequestIntegrityGuard } from './request-integrity-guard';
import { createExploreRateLimitGuard } from './rate-limit-guard';
import { handleExploreRefineRequest, type ExploreRouteDependencies } from './handler';

const INTEGRITY_TOKEN = 'a'.repeat(64);

async function buildDeps(
  overrides: Partial<ExploreRouteDependencies> = {},
): Promise<ExploreRouteDependencies> {
  const integrityGuard = createExploreRequestIntegrityGuard({
    mode: 'enforce',
    telemetry: { record: () => {} },
  });
  return {
    integrityGuard,
    rateLimitGuard: createExploreRateLimitGuard({ now: () => 0 }),
    ...overrides,
  };
}

function exploreRequest(query: string, opts: { integrity?: boolean } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.integrity !== false) {
    headers.cookie = `${CSRF_COOKIE_NAME}=${INTEGRITY_TOKEN}`;
    headers[CSRF_HEADER_NAME] = INTEGRITY_TOKEN;
    headers['sec-fetch-site'] = 'same-origin';
  }
  return new Request(`http://localhost/explore/api${query}`, { headers });
}

test('returns all active-release feature ids with no user filters', async () => {
  const deps = await buildDeps();
  const response = await handleExploreRefineRequest(exploreRequest(''), deps);
  assert.equal(response.status, 200);

  const body = (await response.json()) as { featureIds: readonly string[]; totalMatched: number };
  assert.equal(body.totalMatched, 4);
  assert.ok(body.featureIds.includes('ent_15th_st_church_001'));
});

test('filters by era through the real guardrail + explore filter pipeline', async () => {
  const deps = await buildDeps();
  const response = await handleExploreRefineRequest(exploreRequest('?era=1970s'), deps);
  assert.equal(response.status, 200);

  const body = (await response.json()) as { featureIds: readonly string[]; totalMatched: number };
  assert.equal(body.totalMatched, 1);
  assert.deepEqual(body.featureIds, ['ent_dc_landmark_listing_1975']);
});

test('rejects SQL injection through guardrails (sql_not_allowed)', async () => {
  const deps = await buildDeps();
  const response = await handleExploreRefineRequest(exploreRequest('?sql=DROP+TABLE'), deps);
  assert.equal(response.status, 400);

  const body = (await response.json()) as { error: string; reason: string };
  assert.equal(body.error, 'invalid_explore_query');
  assert.equal(body.reason, 'sql_not_allowed');
});

test('requires request integrity when mode is enforce', async () => {
  const deps = await buildDeps();
  const response = await handleExploreRefineRequest(exploreRequest('', { integrity: false }), deps);
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'request_integrity_required');
});
