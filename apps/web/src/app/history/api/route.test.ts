/**
 * Integration tests for the `/history/api` refine route: App Check, rate limits,
 * and guardrails over the bundled graph snapshot.
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
    mode: 'monitor' as const,
    trustedService: false as const,
  };
}

const noRisk = {
  totalScore: 0,
  byKind: {},
  distinctDimensions: 0,
  exceedsThreshold: false,
};

function createDeps(overrides?: {
  readonly appCheckAllowed?: boolean;
  readonly rateAllowed?: boolean;
}) {
  const keys = new Set<string>();
  return {
    appCheckGuard: async () =>
      overrides?.appCheckAllowed === false
        ? {
            allowed: false as const,
            verified: false as const,
            mode: 'enforce' as const,
            status: 401 as const,
            code: 'APP_CHECK_REQUIRED' as const,
            reason: 'missing_token' as const,
            trustedService: false as const,
          }
        : allowAllAppCheck(),
    rateLimitGuard: {
      evaluate: () =>
        overrides?.rateAllowed === false
          ? {
              allowed: false as const,
              reason: 'token_bucket_exhausted' as const,
              retryAfterMs: 30_000,
              safeRetryAfterSec: 30,
              policyVersion: 'test',
              key: 'k',
              riskAggregation: noRisk,
            }
          : {
              allowed: true as const,
              remaining: 10,
              resetAtMs: 0,
              concurrencyRemaining: 1,
              policyVersion: 'test',
              key: 'k',
              riskAggregation: noRisk,
            },
      release: (key: string) => {
        keys.delete(key);
      },
      formatDeniedResponse: () => ({
        status: 429 as const,
        headers: { 'Retry-After': '30' },
        body: {
          error: 'rate_limit_exceeded' as const,
          message: 'Rate limit exceeded.',
          retryAfterSec: 30,
        },
      }),
    },
  };
}

function request(query = ''): Request {
  return new Request(`http://localhost/history/api${query}`, { headers: {} });
}

test('returns filtered node ids for a valid decade refine query', async () => {
  const response = await handleHistoryRefineRequest(
    request('?decade=1970s&kind=event'),
    createDeps(),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    nodeIds: string[];
    totalMatched: number;
    sparseDecade: boolean;
  };
  assert.equal(body.totalMatched, 1);
  assert.deepEqual(body.nodeIds, ['ent_dc_landmark_listing_1975']);
  assert.equal(body.sparseDecade, false);
});

test('denies prohibited guardrail keys', async () => {
  const response = await handleHistoryRefineRequest(request('?sql=drop'), createDeps());
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'invalid_history_query');
});

test('requires App Check when guard denies', async () => {
  const response = await handleHistoryRefineRequest(
    request('?decade=1950s'),
    createDeps({ appCheckAllowed: false }),
  );
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
