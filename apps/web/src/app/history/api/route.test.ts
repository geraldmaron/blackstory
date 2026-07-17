/**
 * Integration tests for the `/history/api` refine route (BB-093): App Check, BB-025 rate limits,
 * and BB-049 guardrails over the bundled graph snapshot.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resetHistoryGraphReleaseArtifactForTests } from '../../../data/history-graph-seed';
import { handleHistoryRefineRequest } from './handler';

test.beforeEach(() => {
  resetHistoryGraphReleaseArtifactForTests();
});

function allowAllAppCheck() {
  return {
    allowed: true as const,
    verified: false,
    status: 200,
    reason: 'skipped' as const,
  };
}

function createDeps(overrides?: {
  readonly appCheckAllowed?: boolean;
  readonly rateAllowed?: boolean;
}) {
  const keys = new Set<string>();
  return {
    appCheckGuard: async () =>
      overrides?.appCheckAllowed === false
        ? { allowed: false as const, verified: false, status: 401, reason: 'missing' as const }
        : allowAllAppCheck(),
    rateLimitGuard: {
      evaluate: () =>
        overrides?.rateAllowed === false
          ? { allowed: false as const, key: 'k', retryAfterSeconds: 30 }
          : { allowed: true as const, key: 'k' },
      release: (key: string) => {
        keys.delete(key);
      },
      formatDeniedResponse: () => ({
        status: 429,
        headers: { 'Retry-After': '30' },
        body: { error: 'rate_limited' },
      }),
    },
  };
}

function request(query = ''): Request {
  return new Request(`http://localhost/history/api${query}`, { headers: {} });
}

test('returns filtered node ids for a valid decade refine query', async () => {
  const response = await handleHistoryRefineRequest(request('?decade=1950s&kind=event'), createDeps());
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    nodeIds: string[];
    totalMatched: number;
    sparseDecade: boolean;
  };
  assert.equal(body.totalMatched, 1);
  assert.deepEqual(body.nodeIds, ['ent_seed_event_001']);
  assert.equal(body.sparseDecade, false);
});

test('denies prohibited guardrail keys', async () => {
  const response = await handleHistoryRefineRequest(request('?sql=drop'), createDeps());
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'invalid_history_query');
});

test('requires App Check when guard denies', async () => {
  const response = await handleHistoryRefineRequest(request('?decade=1950s'), createDeps({ appCheckAllowed: false }));
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'app_check_required');
});

test('marks sparse decades in refine responses', async () => {
  const response = await handleHistoryRefineRequest(request('?decade=1700s'), createDeps());
  assert.equal(response.status, 200);
  const body = (await response.json()) as { sparseDecade: boolean; totalMatched: number };
  assert.equal(body.sparseDecade, true);
  assert.equal(body.totalMatched, 0);
});
