/**
 * Integration tests for the `/explore/api` refine route: App Check, rate limits,
 * and `evaluateSearchQueryGuardrails` bound dynamic explore filter queries.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppCheckVerifier } from '@black-book/firebase';
import { createExploreAppCheckGuard } from './app-check-guard';
import { createExploreRateLimitGuard } from './rate-limit-guard';
import { handleExploreRefineRequest, type ExploreRouteDependencies } from './handler';

function acceptingVerifier(appId = 'test-app-id'): AppCheckVerifier {
  return {
    async verifyToken() {
      return { appId };
    },
  };
}

async function buildDeps(
  overrides: Partial<ExploreRouteDependencies> = {},
): Promise<ExploreRouteDependencies> {
  const appCheckGuard = await createExploreAppCheckGuard({
    mode: 'enforce',
    verifier: acceptingVerifier(),
    telemetry: { record: () => {} },
  });
  return {
    appCheckGuard,
    rateLimitGuard: createExploreRateLimitGuard({ now: () => 0 }),
    ...overrides,
  };
}

function exploreRequest(query: string, opts: { appCheck?: boolean } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.appCheck !== false) headers['x-firebase-appcheck'] = 'a-real-looking-token';
  return new Request(`http://localhost/explore/api${query}`, { headers });
}

test('returns all active-release feature ids with no user filters', async () => {
  const deps = await buildDeps();
  const response = await handleExploreRefineRequest(exploreRequest(''), deps);
  assert.equal(response.status, 200);

  const body = (await response.json()) as { featureIds: readonly string[]; totalMatched: number };
  assert.equal(body.totalMatched, 4);
  assert.ok(body.featureIds.includes('ent_seed_place_001'));
});

test('filters by era through the real guardrail + explore filter pipeline', async () => {
  const deps = await buildDeps();
  const response = await handleExploreRefineRequest(exploreRequest('?era=1950s'), deps);
  assert.equal(response.status, 200);

  const body = (await response.json()) as { featureIds: readonly string[]; totalMatched: number };
  assert.equal(body.totalMatched, 1);
  assert.deepEqual(body.featureIds, ['ent_seed_event_001']);
});

test('rejects SQL injection through BB-026 guardrails (sql_not_allowed)', async () => {
  const deps = await buildDeps();
  const response = await handleExploreRefineRequest(exploreRequest('?sql=DROP+TABLE'), deps);
  assert.equal(response.status, 400);

  const body = (await response.json()) as { error: string; reason: string };
  assert.equal(body.error, 'invalid_explore_query');
  assert.equal(body.reason, 'sql_not_allowed');
});

test('requires App Check when mode is enforce', async () => {
  const deps = await buildDeps();
  const response = await handleExploreRefineRequest(exploreRequest('', { appCheck: false }), deps);
  assert.equal(response.status, 401);
});
