/**
 * Tests for the web-search discovery adapter. Fixture-driven; every HTTP call goes
 * through a mock SafeHttpClient injected by the test, never a real fetch or a real key. Proves
 * the two independent fail-closed gates (registry disabled-by-default, and the
 * storageTermsConfirmed persistence gate), the researchOnlyOffensive query filter, and that the
 * budget guard can be backed by the real `evaluateDailyBudget` evaluator.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { EvidenceSource } from '../../provenance/source.js';
import { buildQueryPack, parseQueryPackFixture } from '../../query-packs/pack.js';
import type { QueryPack } from '../../query-packs/types.js';
import { approveSourcePolicy, createInMemorySourceRegistry, registerSource, type SourceRegistryEntry } from '../index.js';
import type { SafeHttpRequest, SafeHttpResponse } from '../internet-archive/shared/http-port.js';
import {
  assertQueryTextHasNoResearchOnlyOffensiveTerms,
  assertStorageTermsConfirmed,
  BRAVE_API_KEY_HEADER,
  BRAVE_SEARCH_ADAPTER_ID,
  buildBraveWebSearchUrl,
  buildWebSearchQueryTexts,
  createBraveSearchAdapterContract,
  createSearxngSearchAdapterContract,
  evaluateWebSearchQueryBudget,
  fetchBraveWebSearch,
  fetchBraveWebSearchBudgeted,
  ingestWebSearchCandidatesThroughPipeline,
  normalizeWebSearchResult,
  parseBraveSearchResponse,
  parseSearxngSearchResponse,
  buildSearxngSearchUrl,
  SEARXNG_SEARCH_ADAPTER_ID,
  stampExternalQueryProvenance,
  WEB_SEARCH_DEFAULT_CLASSIFICATION,
  WEB_SEARCH_PROVIDER_DECISION,
  type DailyBudgetDecision,
  type DailyBudgetEvaluator,
  type WebSearchProviderConfig,
} from './index.js';

const FIXED_NOW = '2026-07-17T20:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const FAKE_API_KEY = 'test-deterministic-brave-key';

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as T;
}

function loadPack(): QueryPack {
  const raw = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'query-packs', 'fixtures', 'person-civil-rights-fixture.v1.json'), 'utf8'),
  ) as unknown;
  return parseQueryPackFixture(raw).pack;
}

function unconfirmedConfig(): WebSearchProviderConfig {
  return { provider: 'brave', apiKey: FAKE_API_KEY, storageTermsConfirmed: false, planTermsVersion: 'brave-storage-rights-tier-2026-07' };
}

function confirmedConfig(): WebSearchProviderConfig {
  return { ...unconfirmedConfig(), storageTermsConfirmed: true };
}

function braveRegistryEntry(): SourceRegistryEntry {
  const contract = createBraveSearchAdapterContract();
  const evidenceSource: EvidenceSource = {
    id: 'src_brave_search',
    organizationId: 'org_community',
    displayName: 'Brave Search API Discovery',
    classification: contract.classification,
    adapterId: BRAVE_SEARCH_ADAPTER_ID,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    killSwitchId: 'adapter:brave_search',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  return {
    id: 'reg_brave_search',
    contract,
    evidenceSource,
    registryState: 'approved',
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

// ---------------------------------------------------------------------------------------------
// Provider decision
// ---------------------------------------------------------------------------------------------

test('provider decision prefers SearXNG and does NOT claim storage terms are confirmed', () => {
  assert.equal(WEB_SEARCH_PROVIDER_DECISION.chosenProvider, 'searxng');
  assert.equal(WEB_SEARCH_PROVIDER_DECISION.storageTermsConfirmedInWriting, false);
  assert.ok(WEB_SEARCH_PROVIDER_DECISION.reasoning.length >= 3);
});

// ---------------------------------------------------------------------------------------------
// registry gate (first of two independent gates)
// ---------------------------------------------------------------------------------------------

test('Brave search adapter starts disabled by default in the  registry', () => {
  const store = createInMemorySourceRegistry();
  const contract = createBraveSearchAdapterContract();
  registerSource(store, {
    id: 'reg_brave',
    contract,
    evidenceSource: {
      id: 'src_brave_search',
      displayName: 'Brave Search API Discovery',
      classification: contract.classification,
      adapterId: BRAVE_SEARCH_ADAPTER_ID,
      stableIdScheme: contract.stableIdScheme,
      policy: contract.policy,
      adapterEnabled: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    },
    createdAt: FIXED_NOW,
  });
  assert.equal(store.get('reg_brave')?.registryState, 'disabled');
  const approved = approveSourcePolicy(store, { id: 'reg_brave', approvedBy: 'admin@blackbook.local', approvedAt: FIXED_NOW });
  assert.equal(approved.registryState, 'approved');
});

// ---------------------------------------------------------------------------------------------
// Brave client
// ---------------------------------------------------------------------------------------------

test('buildBraveWebSearchUrl produces a well-formed query URL and requires a query', () => {
  const url = buildBraveWebSearchUrl({ query: 'freedom rider Montgomery Alabama', count: 10, offset: 5 });
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'api.search.brave.com');
  assert.equal(parsed.searchParams.get('q'), 'freedom rider Montgomery Alabama');
  assert.equal(parsed.searchParams.get('count'), '10');
  assert.equal(parsed.searchParams.get('offset'), '5');
  assert.throws(() => buildBraveWebSearchUrl({ query: '   ' }), /query text is required/);
});

test('parseBraveSearchResponse tolerates missing title/description and rejects results with no url', () => {
  const batch = parseBraveSearchResponse(loadFixture('brave-search-response.json'));
  assert.equal(batch.results.length, 3);
  assert.equal(batch.results[2]?.title, undefined);
  assert.equal(batch.rejected.length, 1);
  assert.equal(batch.rejected[0]?.reason, 'missing_url');
  assert.throws(() => parseBraveSearchResponse('not an object'), /must be an object/);
});

test('buildSearxngSearchUrl targets operator base URL with format=json', () => {
  const url = buildSearxngSearchUrl({
    baseUrl: 'http://100.119.72.84:8888',
    query: 'freedom rider Montgomery Alabama',
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'http://100.119.72.84:8888');
  assert.equal(parsed.pathname, '/search');
  assert.equal(parsed.searchParams.get('format'), 'json');
  assert.equal(parsed.searchParams.get('q'), 'freedom rider Montgomery Alabama');
  assert.throws(() => buildSearxngSearchUrl({ baseUrl: 'http://x', query: '  ' }), /query text is required/);
});

test('parseSearxngSearchResponse maps content→description and rejects missing urls', () => {
  const batch = parseSearxngSearchResponse(loadFixture('searxng-search-response.json'));
  assert.equal(batch.results.length, 3);
  assert.equal(batch.results[0]?.description?.includes('Freedom Rides'), true);
  assert.equal(batch.results[2]?.title, undefined);
  assert.equal(batch.rejected.length, 1);
  assert.equal(batch.rejected[0]?.reason, 'missing_url');
});

test('SearXNG adapter contract uses searxng_search id', () => {
  const contract = createSearxngSearchAdapterContract();
  assert.equal(contract.adapterId, SEARXNG_SEARCH_ADAPTER_ID);
});

// ---------------------------------------------------------------------------------------------
// Query generation from packs -- researchOnlyOffensive filter
// ---------------------------------------------------------------------------------------------

test('buildWebSearchQueryTexts includes geographic seeds but never a researchOnlyOffensive term', () => {
  const pack = loadPack();
  const hasOffensiveTerm = pack.terms.some((term) => term.researchOnlyOffensive === true && term.text === 'colored school');
  assert.ok(hasOffensiveTerm, 'fixture must contain a researchOnlyOffensive term for this test to be meaningful');

  const queries = buildWebSearchQueryTexts({
    pack,
    geographicSeeds: [{ state: 'Alabama', county: 'Montgomery County' }],
  });
  assert.equal(queries.length, 1);
  const queryText = queries[0]!;
  assert.match(queryText, /Montgomery County/);
  assert.match(queryText, /Alabama/);
  assert.equal(queryText.toLowerCase().includes('colored school'), false);
});

test('assertQueryTextHasNoResearchOnlyOffensiveTerms throws when offensive text is present, passes otherwise', () => {
  const pack = loadPack();
  assert.throws(
    () => assertQueryTextHasNoResearchOnlyOffensiveTerms('search for colored school enrollment records', pack),
    /researchOnlyOffensive term/,
  );
  assert.doesNotThrow(() => assertQueryTextHasNoResearchOnlyOffensiveTerms('civil rights activist Montgomery Alabama', pack));
});

test('buildWebSearchQueryTexts requires at least one geographic seed and public-safe core terms', () => {
  const pack = loadPack();
  assert.throws(() => buildWebSearchQueryTexts({ pack, geographicSeeds: [] }), /geographic seed/);
});

test('buildWebSearchQueryTexts excludes a researchOnlyOffensive term even when its class would otherwise qualify it as a core term', () => {
  // The gold fixture's offensive term ("colored school") is `historical`-classed, so it is
  // already excluded from core (positive/alias) terms by class alone -- that does not prove the
  // researchOnlyOffensive filter itself is doing anything. This pack puts the offensive term in
  // the `positive` class specifically, so it WOULD have been selected as a core term if the
  // researchOnlyOffensive filter were not applied.
  const pack = buildQueryPack({
    id: 'qp-offensive-positive-class-test',
    displayName: 'Offensive positive-class term test pack',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    terms: [
      { text: 'civil rights activist', termClass: 'positive' },
      { text: 'restricted covenant enforcer', termClass: 'positive', researchOnlyOffensive: true },
    ],
    createdAt: FIXED_NOW,
  });
  const queries = buildWebSearchQueryTexts({ pack, geographicSeeds: [{ state: 'Alabama' }] });
  assert.equal(queries.length, 1);
  assert.equal(queries[0]!.toLowerCase().includes('restricted covenant enforcer'), false);
  assert.match(queries[0]!, /civil rights activist/);
});

// ---------------------------------------------------------------------------------------------
// Provenance stamping
// ---------------------------------------------------------------------------------------------

test('stampExternalQueryProvenance stamps API name, query text, timestamp, and plan/terms version', () => {
  const stamped = stampExternalQueryProvenance({
    provider: 'brave',
    queryText: 'civil rights activist Montgomery Alabama',
    executedAt: FIXED_NOW,
    planTermsVersion: 'brave-storage-rights-tier-2026-07',
  });
  assert.equal(stamped.apiName, 'Brave Search API');
  assert.equal(stamped.queryText, 'civil rights activist Montgomery Alabama');
  assert.equal(stamped.executedAt, FIXED_NOW);
  assert.equal(stamped.planTermsVersion, 'brave-storage-rights-tier-2026-07');
  assert.throws(() => stampExternalQueryProvenance({ provider: 'brave', queryText: '', executedAt: FIXED_NOW, planTermsVersion: 'v1' }), /queryText/);
});

// ---------------------------------------------------------------------------------------------
// CRITICAL: storage-terms persistence gate
// ---------------------------------------------------------------------------------------------

test('assertStorageTermsConfirmed throws when false, passes when true', () => {
  assert.throws(() => assertStorageTermsConfirmed(unconfirmedConfig()), /storageTermsConfirmed is false/);
  assert.doesNotThrow(() => assertStorageTermsConfirmed(confirmedConfig()));
});

test('CRITICAL: a search result cannot be normalized/persisted without storageTermsConfirmed=true', () => {
  const entry = braveRegistryEntry();
  const queryProvenance = stampExternalQueryProvenance({
    provider: 'brave',
    queryText: 'civil rights activist Montgomery',
    executedAt: FIXED_NOW,
    planTermsVersion: 'brave-storage-rights-tier-2026-07',
  });
  assert.throws(
    () =>
      normalizeWebSearchResult({
        result: { title: 'Example', url: 'https://example.org/page', description: 'A description.' },
        registryEntry: entry,
        runId: 'run_1',
        capturedAt: FIXED_NOW,
        config: unconfirmedConfig(),
        queryProvenance,
      }),
    /storageTermsConfirmed is false/,
  );

  const candidate = normalizeWebSearchResult({
    result: { title: 'Example', url: 'https://example.org/page', description: 'A description.' },
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
    config: confirmedConfig(),
    queryProvenance,
  });
  assert.equal(candidate.provenance.adapterId, BRAVE_SEARCH_ADAPTER_ID);
  assert.equal(candidate.classification, WEB_SEARCH_DEFAULT_CLASSIFICATION);
  assert.equal(candidate.payload.query.apiName, 'Brave Search API');
  assert.equal('fullText' in candidate.payload, false);
  assert.equal('body' in candidate.payload, false);
});

// ---------------------------------------------------------------------------------------------
// fetchBraveWebSearch: injected SafeHttpClient, header-based auth, storage gate downstream
// ---------------------------------------------------------------------------------------------

test('fetchBraveWebSearch requires a non-empty API key and never hardcodes one', async () => {
  const entry = braveRegistryEntry();
  const client = async (): Promise<SafeHttpResponse> => ({
    status: 200,
    headers: { 'content-type': 'application/json' },
    bodyText: JSON.stringify(loadFixture('brave-search-response.json')),
    finalUrl: '',
  });
  await assert.rejects(
    () =>
      fetchBraveWebSearch({
        query: 'x',
        config: { ...confirmedConfig(), apiKey: '' },
        registryEntry: entry,
        runId: 'r',
        capturedAt: FIXED_NOW,
        client,
      }),
    /BRAVE_SEARCH_API_KEY is required/,
  );
});

test('fetchBraveWebSearch sends the API key as a header (never a query param) through the injected client', async () => {
  const entry = braveRegistryEntry();
  const requests: SafeHttpRequest[] = [];
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    requests.push(request);
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(loadFixture('brave-search-response.json')),
      finalUrl: request.url,
    };
  };
  const candidates = await fetchBraveWebSearch({
    query: 'civil rights activist Montgomery',
    config: confirmedConfig(),
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
    client,
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.headers?.[BRAVE_API_KEY_HEADER], FAKE_API_KEY);
  assert.equal(requests[0]?.url.includes(FAKE_API_KEY), false, 'API key must never appear in the URL');
  assert.equal(candidates.length, 3);
});

test('fetchBraveWebSearch performs the live query even when storageTermsConfirmed=false, but normalization refuses to persist', async () => {
  const entry = braveRegistryEntry();
  let calls = 0;
  const client = async (): Promise<SafeHttpResponse> => {
    calls += 1;
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(loadFixture('brave-search-response.json')),
      finalUrl: '',
    };
  };
  await assert.rejects(
    () =>
      fetchBraveWebSearch({
        query: 'civil rights activist Montgomery',
        config: unconfirmedConfig(),
        registryEntry: entry,
        runId: 'run_1',
        capturedAt: FIXED_NOW,
        client,
      }),
    /storageTermsConfirmed is false/,
  );
  assert.equal(calls, 1, 'the search call itself is not gated by storage-rights confirmation, only persistence is');
});

// ---------------------------------------------------------------------------------------------
// Budget guard
// ---------------------------------------------------------------------------------------------

function fakeEvaluator(decision: DailyBudgetDecision): DailyBudgetEvaluator {
  return () => decision;
}

test('evaluateWebSearchQueryBudget denies once the per-campaign query cap is reached, without calling the evaluator', () => {
  let evaluatorCalls = 0;
  const evaluator: DailyBudgetEvaluator = () => {
    evaluatorCalls += 1;
    return { allowed: true, percentUsed: 0, softShutdownTriggered: false, hardStopTriggered: false };
  };
  const decision = evaluateWebSearchQueryBudget({
    policy: {
      maxQueriesPerCampaign: 5,
      monthlySpendCapUsdCents: 10_000,
      costPerQueryUsdCents: 50,
      monthlyBudgetCategory: 'research_campaign',
    },
    state: { queriesIssuedThisCampaign: 5, queriesIssuedThisMonth: 10 },
    evaluateDailyBudget: evaluator,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'campaign_query_budget_exceeded');
  assert.equal(evaluatorCalls, 0);
});

test('evaluateWebSearchQueryBudget delegates the monthly spend ceiling to the injected  evaluator', () => {
  const denied = evaluateWebSearchQueryBudget({
    policy: {
      maxQueriesPerCampaign: 1000,
      monthlySpendCapUsdCents: 10_000,
      costPerQueryUsdCents: 50,
      monthlyBudgetCategory: 'research_campaign',
    },
    state: { queriesIssuedThisCampaign: 1, queriesIssuedThisMonth: 500 },
    evaluateDailyBudget: fakeEvaluator({ allowed: false, percentUsed: 100, softShutdownTriggered: true, hardStopTriggered: true, reason: 'daily_budget_exceeded' }),
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.monthlyBudget?.hardStopTriggered, true);

  const allowed = evaluateWebSearchQueryBudget({
    policy: {
      maxQueriesPerCampaign: 1000,
      monthlySpendCapUsdCents: 10_000,
      costPerQueryUsdCents: 50,
      monthlyBudgetCategory: 'research_campaign',
    },
    state: { queriesIssuedThisCampaign: 1, queriesIssuedThisMonth: 5 },
    evaluateDailyBudget: fakeEvaluator({ allowed: true, percentUsed: 25, softShutdownTriggered: false, hardStopTriggered: false }),
  });
  assert.equal(allowed.allowed, true);
});

test('fetchBraveWebSearchBudgeted refuses to call the network at all when the budget guard denies', async () => {
  const entry = braveRegistryEntry();
  let clientCalls = 0;
  const client = async (): Promise<SafeHttpResponse> => {
    clientCalls += 1;
    return { status: 200, headers: { 'content-type': 'application/json' }, bodyText: JSON.stringify(loadFixture('brave-search-response.json')), finalUrl: '' };
  };
  await assert.rejects(
    () =>
      fetchBraveWebSearchBudgeted({
        query: 'civil rights activist Montgomery',
        config: confirmedConfig(),
        registryEntry: entry,
        runId: 'run_1',
        capturedAt: FIXED_NOW,
        client,
        budgetPolicy: { maxQueriesPerCampaign: 0, monthlySpendCapUsdCents: 10_000, costPerQueryUsdCents: 50, monthlyBudgetCategory: 'research_campaign' },
        budgetState: { queriesIssuedThisCampaign: 0, queriesIssuedThisMonth: 0 },
        evaluateDailyBudget: fakeEvaluator({ allowed: true, percentUsed: 0, softShutdownTriggered: false, hardStopTriggered: false }),
      }),
    /Web search query budget denied/,
  );
  assert.equal(clientCalls, 0, 'a denied budget must never reach the network');
});

test('fetchBraveWebSearchBudgeted proceeds and reports the budget decision when allowed', async () => {
  const entry = braveRegistryEntry();
  const client = async (): Promise<SafeHttpResponse> => ({
    status: 200,
    headers: { 'content-type': 'application/json' },
    bodyText: JSON.stringify(loadFixture('brave-search-response.json')),
    finalUrl: '',
  });
  const result = await fetchBraveWebSearchBudgeted({
    query: 'civil rights activist Montgomery',
    config: confirmedConfig(),
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
    client,
    budgetPolicy: { maxQueriesPerCampaign: 10, monthlySpendCapUsdCents: 10_000, costPerQueryUsdCents: 50, monthlyBudgetCategory: 'research_campaign' },
    budgetState: { queriesIssuedThisCampaign: 0, queriesIssuedThisMonth: 0 },
    evaluateDailyBudget: fakeEvaluator({ allowed: true, percentUsed: 0, softShutdownTriggered: false, hardStopTriggered: false }),
  });
  assert.equal(result.candidates.length, 3);
  assert.equal(result.budgetDecision.allowed, true);
});

// ---------------------------------------------------------------------------------------------
// Pipeline integration: Wayback capture gate -> ingestApiCandidate
// ---------------------------------------------------------------------------------------------

test('ingestWebSearchCandidatesThroughPipeline routes candidates through the Wayback capture gate before  ingestion', async () => {
  const entry = braveRegistryEntry();
  const pack = loadPack();
  const queryProvenance = stampExternalQueryProvenance({
    provider: 'brave',
    queryText: 'civil rights activist Montgomery',
    executedAt: FIXED_NOW,
    planTermsVersion: 'brave-storage-rights-tier-2026-07',
  });
  const candidate = normalizeWebSearchResult({
    result: { title: 'Piedmont County history', url: 'https://piedmontcountyhistory.example.org/freedom-riders', description: 'History page.' },
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
    config: confirmedConfig(),
    queryProvenance,
  });

  let submitCount = 0;
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    if (request.url === 'https://web.archive.org/save') {
      submitCount += 1;
      return { status: 200, headers: { 'content-type': 'application/json' }, bodyText: JSON.stringify({ job_id: 'job-1' }), finalUrl: '' };
    }
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify({ status: 'success', timestamp: '20260717140512', original_url: candidate.canonicalUrl }),
      finalUrl: '',
    };
  };

  const ingested = await ingestWebSearchCandidatesThroughPipeline({
    candidates: [candidate],
    provider: 'brave',
    client,
    credentials: { accessKey: 'ak', secretKey: 'sk' },
    pack,
    now: FIXED_NOW,
  });

  assert.equal(submitCount, 1, 'the discovered URL must go through a real Wayback capture before ingestion');
  assert.equal(ingested.length, 1);
  assert.equal(ingested[0]?.ingestMode, 'api');
  assert.equal(ingested[0]?.status, 'pending');
  assert.equal(ingested[0]?.adapterRecord.provenance.adapterId, BRAVE_SEARCH_ADAPTER_ID);
});

test('ingestWebSearchCandidatesThroughPipeline fails closed when the Wayback capture fails -- no silent ingestion', async () => {
  const entry = braveRegistryEntry();
  const pack = loadPack();
  const queryProvenance = stampExternalQueryProvenance({
    provider: 'brave',
    queryText: 'civil rights activist Montgomery',
    executedAt: FIXED_NOW,
    planTermsVersion: 'brave-storage-rights-tier-2026-07',
  });
  const candidate = normalizeWebSearchResult({
    result: { title: 'Broken capture page', url: 'https://example.org/broken', description: 'History page.' },
    registryEntry: entry,
    runId: 'run_1',
    capturedAt: FIXED_NOW,
    config: confirmedConfig(),
    queryProvenance,
  });

  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    if (request.url === 'https://web.archive.org/save') {
      return { status: 200, headers: { 'content-type': 'application/json' }, bodyText: JSON.stringify({ job_id: 'job-1' }), finalUrl: '' };
    }
    return { status: 200, headers: { 'content-type': 'application/json' }, bodyText: JSON.stringify({ status: 'error', message: 'blocked_by_robots' }), finalUrl: '' };
  };

  await assert.rejects(
    () =>
      ingestWebSearchCandidatesThroughPipeline({
        candidates: [candidate],
        provider: 'brave',
        client,
        credentials: { accessKey: 'ak', secretKey: 'sk' },
        pack,
        now: FIXED_NOW,
      }),
    /did not succeed/,
  );
});

// ---------------------------------------------------------------------------------------------
// Real wiring: proves the budget-guard port can be backed by the real evaluateDailyBudget
// ---------------------------------------------------------------------------------------------

test('a real -backed DailyBudgetEvaluator (thin wrapper over the real evaluateDailyBudget) composes correctly', async () => {
  const { evaluateDailyBudget: realEvaluateDailyBudget } = await import('@repo/security');

  const realBackedEvaluator: DailyBudgetEvaluator = (input, budgets) => {
    const result = (realEvaluateDailyBudget as unknown as (
      i: { category: string; consumed: number; billingAlertPercent?: number },
      b?: unknown,
    ) => DailyBudgetDecision & { failClosed?: boolean; policyVersion?: string })(input, budgets);
    return result;
  };

  const denied = evaluateWebSearchQueryBudget({
    policy: {
      maxQueriesPerCampaign: 1000,
      monthlySpendCapUsdCents: 1_000,
      costPerQueryUsdCents: 50,
      monthlyBudgetCategory: 'research_campaign',
    },
    state: { queriesIssuedThisCampaign: 1, queriesIssuedThisMonth: 100 },
    evaluateDailyBudget: realBackedEvaluator,
  });
  assert.equal(denied.allowed, false, 'consuming 5000 cents against a 1000-cent cap must be denied by the real evaluator');
  assert.equal(denied.monthlyBudget?.hardStopTriggered, true);

  const allowed = evaluateWebSearchQueryBudget({
    policy: {
      maxQueriesPerCampaign: 1000,
      monthlySpendCapUsdCents: 100_000,
      costPerQueryUsdCents: 50,
      monthlyBudgetCategory: 'research_campaign',
    },
    state: { queriesIssuedThisCampaign: 1, queriesIssuedThisMonth: 10 },
    evaluateDailyBudget: realBackedEvaluator,
  });
  assert.equal(allowed.allowed, true, '500 cents against a 100000-cent cap must be allowed');
});
