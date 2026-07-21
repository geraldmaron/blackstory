/**
 * Integration tests for the public search route. These exercise the REAL route handler
 * end-to-end request-integrity guard, rate limiter, `evaluateSearchQueryGuardrails`, and
 * the `runPublicSearch` pipeline over the real seed snapshot index not any component in
 * isolation. That is the point: guardrail was unit-tested but had zero wired callers, so
 * these tests prove adversarial input is bounded by the guardrail through the actual HTTP route.
 *
 * Style follows `apps/web/src/app/submit/*.test.ts`: plain `node:test`, real objects, no mocking
 * framework. Request integrity is driven by injecting a real enforce-mode guard with matching
 * cookie/header tokens; the rate limiter runs on a deterministic fixed clock.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../lib/web-security/csrf';
import { getSnapshotSearchIndex } from '../../../lib/search/snapshot-search-index';
import { createSearchRequestIntegrityGuard } from './request-integrity-guard';
import { createSearchRateLimitGuard } from './rate-limit-guard';
import { handleSearchRequest, type SearchRouteDependencies } from './handler';

const SCHOOL_ID = 'ent_dunbar_school_001';
const EVENT_ID = 'ent_dc_landmark_listing_1975';
const INTEGRITY_TOKEN = 'a'.repeat(64);

/** Fresh dependency set per test a new rate-limit bucket so quotas never leak between tests.  */
async function buildDeps(
  overrides: Partial<SearchRouteDependencies> = {},
): Promise<SearchRouteDependencies> {
  const integrityGuard = createSearchRequestIntegrityGuard({
    mode: 'enforce',
    telemetry: { record: () => {} },
  });
  return {
    integrityGuard,
    rateLimitGuard: createSearchRateLimitGuard({ now: () => 0 }),
    searchIndex: getSnapshotSearchIndex(),
    ...overrides,
  };
}

function searchRequest(query: string, opts: { integrity?: boolean } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.integrity !== false) {
    headers.cookie = `${CSRF_COOKIE_NAME}=${INTEGRITY_TOKEN}`;
    headers[CSRF_HEADER_NAME] = INTEGRITY_TOKEN;
    headers['sec-fetch-site'] = 'same-origin';
  }
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
  assert.equal(
    unfiltered.totalMatched,
    4,
    'offline snapshot keeps the four Dunbar-lineage entities in Washington, D.C.',
  );

  const filtered = (await (
    await handleSearchRequest(
      searchRequest(`?state=${stateParam}&status=active`),
      await buildDeps(),
    )
  ).json()) as SearchBody;
  assert.equal(
    filtered.totalMatched,
    3,
    'the statusless 1975 landmark-listing event is excluded by status=active',
  );
  assert.ok(!filtered.results.some((r) => r.id === EVENT_ID));
});

test('the era filter narrows results through the real route (AC5)', async () => {
  const filtered = (await (
    await handleSearchRequest(searchRequest('?q=education&era=1890s'), await buildDeps())
  ).json()) as SearchBody;
  assert.equal(filtered.totalMatched, 1);
  assert.equal(filtered.results[0]?.id, SCHOOL_ID, 'only the school overlaps the 1890s era bucket');
});

test('a missing request-integrity token is denied (401 request_integrity_required)', async () => {
  const deps = await buildDeps();
  const response = await handleSearchRequest(
    searchRequest('?q=freedmen', { integrity: false }),
    deps,
  );
  assert.equal(response.status, 401);

  const body = (await response.json()) as { error: string; reason: string };
  assert.equal(body.error, 'request_integrity_required');
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
  // Offline snapshot is the Dunbar cluster only; national-catalog search docs come from
  // Firestore in production. Query a term that hits multiple Dunbar fixtures.
  const deps = await buildDeps();

  const first = (await (
    await handleSearchRequest(searchRequest('?q=dunbar&pageSize=1'), deps)
  ).json()) as SearchBody;
  assert.equal(first.results.length, 1);
  assert.equal(first.hasMore, true);
  assert.ok(first.nextCursor, 'a first page with more results must return a nextCursor');
  const firstId = first.results[0]?.id;

  const second = (await (
    await handleSearchRequest(
      searchRequest(`?q=dunbar&pageSize=1&cursor=${encodeURIComponent(first.nextCursor!)}`),
      deps,
    )
  ).json()) as SearchBody;
  assert.equal(second.results.length, 1);
  const secondId = second.results[0]?.id;

  assert.notEqual(firstId, secondId, 'the second page must not repeat the first page');
  assert.ok(
    firstId === SCHOOL_ID || secondId === SCHOOL_ID,
    'Dunbar school should appear in top pages',
  );
});

test('suggest mode returns typeahead recommendations without running search guardrails empty_query', async () => {
  const deps = await buildDeps();
  const response = await handleSearchRequest(searchRequest('?suggest=1&q=laurence'), deps);
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    readonly suggestions: readonly {
      readonly id: string;
      readonly displayName: string;
      readonly href: string;
    }[];
  };
  assert.ok(Array.isArray(body.suggestions));
  assert.ok(body.suggestions.length >= 1);
  assert.ok(
    body.suggestions.some((row) => row.id === SCHOOL_ID),
    'expected Dunbar school among suggestions',
  );
  assert.ok(body.suggestions.every((row) => row.href.startsWith('/entity/')));
});

test('suggest mode returns empty list for short queries', async () => {
  const deps = await buildDeps();
  const response = await handleSearchRequest(searchRequest('?suggest=1&q=a'), deps);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { readonly suggestions: unknown[] };
  assert.deepEqual(body.suggestions, []);
});

test('suggest mode still rejects prohibited sql parameter', async () => {
  const deps = await buildDeps();
  const response = await handleSearchRequest(searchRequest('?suggest=1&q=harlem&sql=1'), deps);
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string; reason: string };
  assert.equal(body.error, 'invalid_search_query');
  assert.equal(body.reason, 'sql_not_allowed');
});
