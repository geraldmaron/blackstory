/**
 * Integration tests for the public search route. These exercise the REAL route handler
 * end-to-end App Check guard, rate limiter, `evaluateSearchQueryGuardrails`, and
 * the `runPublicSearch` pipeline over the real seed snapshot index not any component in
 * isolation. That is the point: guardrail was unit-tested but had zero wired callers, so
 * these tests prove adversarial input is bounded by the guardrail through the actual HTTP route.
 *
 * Style follows `apps/web/src/app/submit/*.test.ts`: plain `node:test`, real objects, no mocking
 * framework. App Check is driven by injecting a fake accepting verifier (the same DI seam the
 * submit App Check guard test uses); the rate limiter runs on a deterministic fixed clock.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppCheckVerifier } from '@blap/firebase';
import { getSnapshotSearchIndex } from '../../../lib/search/snapshot-search-index';
import { createSearchAppCheckGuard } from './app-check-guard';
import { createSearchRateLimitGuard } from './rate-limit-guard';
import { handleSearchRequest, type SearchRouteDependencies } from './handler';

const SCHOOL_ID = 'ent_dunbar_school_001';
const PLACE_ID = 'ent_15th_st_church_001';
const EVENT_ID = 'ent_dc_landmark_listing_1975';

function acceptingVerifier(appId = 'test-app-id'): AppCheckVerifier {
  return {
    async verifyToken() {
      return { appId };
    },
  };
}

/** Fresh dependency set per test a new rate-limit bucket so quotas never leak between tests.  */
async function buildDeps(
  overrides: Partial<SearchRouteDependencies> = {},
): Promise<SearchRouteDependencies> {
  const appCheckGuard = await createSearchAppCheckGuard({
    mode: 'enforce',
    verifier: acceptingVerifier(),
    telemetry: { record: () => {} },
  });
  return {
    appCheckGuard,
    rateLimitGuard: createSearchRateLimitGuard({ now: () => 0 }),
    searchIndex: getSnapshotSearchIndex(),
    ...overrides,
  };
}

function searchRequest(query: string, opts: { appCheck?: boolean } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.appCheck !== false) headers['x-firebase-appcheck'] = 'a-real-looking-token';
  return new Request(`http://localhost/search/api${query}`, { headers });
}

type SearchBody = {
  readonly results: readonly { readonly id: string }[];
  readonly totalMatched: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
};

test('a valid query returns 200 with real snapshot results', async () => {
  const deps = await buildDeps();
  const response = await handleSearchRequest(searchRequest('?q=laurence'), deps);
  assert.equal(response.status, 200);

  const body = (await response.json()) as SearchBody;
  assert.ok(body.totalMatched >= 1);
  assert.ok(
    body.results.some((r) => r.id === SCHOOL_ID),
    'expected the Paul Laurence Dunbar High School fixture in the results',
  );
});

test('rejects a SQL field-injection attempt through the real route (sql_not_allowed)', async () => {
  const deps = await buildDeps();
  const response = await handleSearchRequest(searchRequest('?sql=DROP+TABLE'), deps);
  assert.equal(response.status, 400);

  const body = (await response.json()) as { error: string; reason: string };
  assert.equal(body.error, 'invalid_search_query');
  assert.equal(body.reason, 'sql_not_allowed');
});

test('rejects a wildcard-only query through the real route (wildcard_only)', async () => {
  const deps = await buildDeps();
  const response = await handleSearchRequest(searchRequest('?q=***'), deps);
  assert.equal(response.status, 400);

  const body = (await response.json()) as { error: string; reason: string };
  assert.equal(body.error, 'invalid_search_query');
  assert.equal(body.reason, 'wildcard_only');
});

test('the status filter narrows results through the real route (AC5)', async () => {
  const deps = await buildDeps();
  const stateParam = encodeURIComponent('Washington, D.C.');

  const unfiltered = (await (
    await handleSearchRequest(searchRequest(`?state=${stateParam}`), deps)
  ).json()) as SearchBody;
  assert.equal(unfiltered.totalMatched, 4, 'all four seed entities share the Washington, D.C. jurisdiction');

  const filtered = (await (
    await handleSearchRequest(searchRequest(`?state=${stateParam}&status=active`), await buildDeps())
  ).json()) as SearchBody;
  assert.equal(filtered.totalMatched, 3, 'the statusless 1975 landmark-listing event is excluded by status=active');
  assert.ok(!filtered.results.some((r) => r.id === EVENT_ID));
});

test('the era filter narrows results through the real route (AC5)', async () => {
  const filtered = (await (
    await handleSearchRequest(searchRequest('?q=education&era=1890s'), await buildDeps())
  ).json()) as SearchBody;
  assert.equal(filtered.totalMatched, 1);
  assert.equal(filtered.results[0]?.id, SCHOOL_ID, 'only the school overlaps the 1890s era bucket');
});

test('a missing App Check token is denied (401 app_check_required)', async () => {
  const deps = await buildDeps();
  const response = await handleSearchRequest(
    searchRequest('?q=freedmen', { appCheck: false }),
    deps,
  );
  assert.equal(response.status, 401);

  const body = (await response.json()) as { error: string; reason: string };
  assert.equal(body.error, 'app_check_required');
  assert.equal(body.reason, 'missing_token');
});

test('repeated calls exhaust the rate limit and are denied (429)', async () => {
  // Share ONE dependency set (one bucket) across the loop. The anonymous `search` rolling-window
  // cap is 8; on a fixed clock no tokens refill, so the 9th call in the window must be denied.
  const deps = await buildDeps();
  for (let i = 0; i < 8; i += 1) {
    const ok = await handleSearchRequest(searchRequest('?q=education'), deps);
    assert.equal(ok.status, 200, `call ${i + 1} should be allowed`);
  }

  const denied = await handleSearchRequest(searchRequest('?q=education'), deps);
  assert.equal(denied.status, 429);
  const body = (await denied.json()) as { error: string };
  assert.equal(body.error, 'rate_limit_exceeded');
});

test('cursor round-trip returns the next page, not the same page', async () => {
  // The snapshot index has exactly 2 records that match "education"; pageSize=1 forces pagination.
  const deps = await buildDeps();

  const first = (await (
    await handleSearchRequest(searchRequest('?q=education&pageSize=1'), deps)
  ).json()) as SearchBody;
  assert.equal(first.results.length, 1);
  assert.equal(first.hasMore, true);
  assert.ok(first.nextCursor, 'a first page with more results must return a nextCursor');
  const firstId = first.results[0]?.id;

  const second = (await (
    await handleSearchRequest(
      searchRequest(`?q=education&pageSize=1&cursor=${encodeURIComponent(first.nextCursor!)}`),
      deps,
    )
  ).json()) as SearchBody;
  assert.equal(second.results.length, 1);
  assert.equal(second.hasMore, false);
  const secondId = second.results[0]?.id;

  assert.notEqual(firstId, secondId, 'the second page must not repeat the first page');
  // : relatedCount is the real graph-adjacency size, not relatedIds.length the school is
  // connected to both the church (located_at) and the 1975 landmark listing (occurred_at), so it
  // outranks the church (relatedCount 2 vs 1) once the equal "education" topic-tier tie is broken
  // by connection strength.
  assert.equal(firstId, SCHOOL_ID);
  assert.equal(secondId, PLACE_ID);
});
