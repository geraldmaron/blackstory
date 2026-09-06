/**
 * `/search/api` attaches a resolved `/law/{slug}` href to a law/case result (repo-skocy),
 * through the real handler with the real request-integrity + rate-limit guards, and only
 * queries the injected resolver when the page actually holds a law/case row.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPublicSearchIndexDocs, type SearchableEntityRecord } from '@repo/domain';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../../lib/web-security/csrf';
import { createSearchRequestIntegrityGuard } from './request-integrity-guard';
import { createSearchRateLimitGuard } from './rate-limit-guard';
import { handleSearchRequest, type SearchRouteDependencies } from './handler';

const INTEGRITY_TOKEN = 'b'.repeat(64);

function record(
  overrides: Partial<SearchableEntityRecord> & Pick<SearchableEntityRecord, 'id' | 'displayName'>,
): SearchableEntityRecord {
  return {
    kind: 'place',
    aliases: [],
    topicTags: [],
    eraBuckets: [],
    notabilityBasis: [{ criterion: 'documented_site', note: 'basis', evidenceIds: ['ev-1'] }],
    notabilityLabels: ['A documented site.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    relatedCount: 0,
    claimCount: 0,
    ...overrides,
    nameLower: overrides.nameLower ?? overrides.displayName.toLowerCase(),
  };
}

const INDEX = buildPublicSearchIndexDocs('rel-test', [
  record({ id: 'ent_law_cra_1964', kind: 'law', displayName: 'Civil Rights Act of 1964' }),
  record({ id: 'ent_place_dunbar', kind: 'place', displayName: 'Dunbar High School' }),
]).docs;

function searchRequest(query: string): Request {
  return new Request(`http://localhost/search/api${query}`, {
    headers: {
      cookie: `${CSRF_COOKIE_NAME}=${INTEGRITY_TOKEN}`,
      [CSRF_HEADER_NAME]: INTEGRITY_TOKEN,
      'sec-fetch-site': 'same-origin',
    },
  });
}

async function buildDeps(
  resolveLawCaseHref?: SearchRouteDependencies['resolveLawCaseHref'],
): Promise<SearchRouteDependencies> {
  return {
    integrityGuard: createSearchRequestIntegrityGuard({
      mode: 'enforce',
      telemetry: { record: () => {} },
    }),
    rateLimitGuard: createSearchRateLimitGuard({ now: () => 0 }),
    searchIndex: INDEX,
    ...(resolveLawCaseHref ? { resolveLawCaseHref } : {}),
  };
}

type SearchBody = {
  readonly results: readonly { readonly id: string; readonly href?: string }[];
};

test('attaches the resolved href to a law result the injected resolver can resolve', async () => {
  const deps = await buildDeps(async (result) =>
    result.kind === 'law' && result.displayName === 'Civil Rights Act of 1964'
      ? '/law/civil-rights-act-1964'
      : undefined,
  );
  const body = (await (
    await handleSearchRequest(searchRequest('?q=civil+rights+act'), deps)
  ).json()) as SearchBody;

  const law = body.results.find((r) => r.id.endsWith('ent_law_cra_1964'));
  assert.ok(law, 'expected the law fixture in the results');
  assert.equal(law!.href, '/law/civil-rights-act-1964');
});

test('leaves href unset when the resolver has nothing — no field, not a fabricated one', async () => {
  const deps = await buildDeps(async () => undefined);
  const body = (await (
    await handleSearchRequest(searchRequest('?q=civil+rights+act'), deps)
  ).json()) as SearchBody;

  const law = body.results.find((r) => r.id.endsWith('ent_law_cra_1964'));
  assert.ok(law);
  assert.equal(law!.href, undefined);
});

test('never calls the resolver when the page holds no law/case row', async () => {
  let calls = 0;
  const deps = await buildDeps(async () => {
    calls += 1;
    return undefined;
  });
  await handleSearchRequest(searchRequest('?q=dunbar'), deps);
  assert.equal(calls, 0, 'a place-only page must not pay for a legal-catalog lookup');
});

test("omitting the dependency entirely (today's production shape before repo-skocy) still works", async () => {
  const deps = await buildDeps();
  const response = await handleSearchRequest(searchRequest('?q=civil+rights+act'), deps);
  assert.equal(response.status, 200);
  const body = (await response.json()) as SearchBody;
  const law = body.results.find((r) => r.id.endsWith('ent_law_cra_1964'));
  assert.ok(law);
  assert.equal(law!.href, undefined);
});
