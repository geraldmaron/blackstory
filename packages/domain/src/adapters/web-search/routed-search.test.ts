/**
 * Pins the leads boundary.
 *
 * The assertions that matter most here are about what a lead is NOT: it carries no page text, it
 * never becomes a candidate record, and the absence of a budget is reported rather than assumed.
 * Each of those three is a property a future change could quietly drop while every other test in
 * this file kept passing.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeRoutedSearch,
  runRoutedWebSearch,
  type RoutedSearchHttpClient,
  type WebSearchProviderConfig,
} from './index.js';

const EXECUTED_AT = '2026-09-08T12:00:00.000Z';

const SEARXNG: WebSearchProviderConfig = {
  provider: 'searxng',
  apiKey: '',
  storageTermsConfirmed: false,
  planTermsVersion: 'searxng-self-hosted-research-2026-07',
  baseUrl: 'http://127.0.0.1:8888',
};

function searxngBody(
  results: readonly { url: string; title?: string; content?: string }[],
): string {
  return JSON.stringify({ results });
}

/** Records every request and replays a scripted body per call. */
function scriptedClient(bodies: readonly string[]): {
  readonly client: RoutedSearchHttpClient;
  readonly requests: { url: string; headers?: Readonly<Record<string, string>> }[];
} {
  const requests: { url: string; headers?: Readonly<Record<string, string>> }[] = [];
  let call = 0;
  const client: RoutedSearchHttpClient = async (request) => {
    requests.push({ url: request.url, ...(request.headers ? { headers: request.headers } : {}) });
    const bodyText = bodies[Math.min(call, bodies.length - 1)]!;
    call += 1;
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText,
      finalUrl: request.url,
    };
  };
  return { client, requests };
}

test('a lead carries the engine blurb under a name that cannot be read as page content', async () => {
  const { client } = scriptedClient([
    searxngBody([
      { url: 'https://si.edu/object/1', title: 'Object 1', content: 'A blurb from the engine.' },
    ]),
  ]);
  const result = await runRoutedWebSearch({
    queries: [{ query: '"Frederick McKinley Jones" patent', needId: 'need_x', seeking: 'patent' }],
    config: SEARXNG,
    client,
    executedAt: EXECUTED_AT,
  });
  const lead = result.leads[0]!;
  assert.equal(lead.url, 'https://si.edu/object/1');
  assert.equal(lead.title, 'Object 1');
  assert.equal(lead.engineDescription, 'A blurb from the engine.');
  assert.equal(lead.provider, 'searxng');
  assert.equal(lead.executedAt, EXECUTED_AT);
  // The need travels with the lead, so a lead can be traced to the gap that asked for it.
  assert.equal(lead.needId, 'need_x');
  assert.equal(lead.seeking, 'patent');
  // No field a claim extractor could mistake for retrieved text.
  assert.ok(!('text' in lead), 'a lead must not carry page text');
  assert.ok(!('snippet' in lead), 'a lead must not carry a snippet');
  assert.ok(!('excerpt' in lead), 'a lead must not carry an excerpt');
});

test('leads are produced with storageTermsConfirmed false, because nothing is persisted', async () => {
  // The gate guards turning a result into a row. If holding a lead in memory required the gate,
  // the gate would have become a check on whether a query may run.
  const { client } = scriptedClient([searxngBody([{ url: 'https://nps.gov/a' }])]);
  const result = await runRoutedWebSearch({
    queries: [{ query: 'anything' }],
    config: { ...SEARXNG, storageTermsConfirmed: false },
    client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(result.leads.length, 1);
});

test('the same page returned by two queries is one lead', async () => {
  const { client } = scriptedClient([
    searxngBody([{ url: 'https://nps.gov/place?a=1&b=2' }]),
    // Same page, different spelling: tracking parameter, reordered query, host case, fragment.
    searxngBody([{ url: 'https://NPS.gov/place?b=2&utm_source=x&a=1#top' }]),
  ]);
  const result = await runRoutedWebSearch({
    queries: [{ query: 'one' }, { query: 'two' }],
    config: SEARXNG,
    client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(result.queriesIssued, 2);
  assert.equal(result.leads.length, 1);
  assert.equal(result.duplicateLeadsDropped, 1);
});

test('maxLeadsPerQuery bounds breadth per query', async () => {
  const many = Array.from({ length: 20 }, (_v, index) => ({ url: `https://example.org/${index}` }));
  const { client } = scriptedClient([searxngBody(many)]);
  const result = await runRoutedWebSearch({
    queries: [{ query: 'broad' }],
    config: SEARXNG,
    client,
    executedAt: EXECUTED_AT,
    maxLeadsPerQuery: 3,
  });
  assert.equal(result.leads.length, 3);
});

test('one failing query does not discard the others', async () => {
  let call = 0;
  const client: RoutedSearchHttpClient = async (request) => {
    call += 1;
    if (call === 1) throw new Error('engines suspended');
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: searxngBody([{ url: 'https://loc.gov/item/2' }]),
      finalUrl: request.url,
    };
  };
  const result = await runRoutedWebSearch({
    queries: [{ query: 'first' }, { query: 'second' }],
    config: SEARXNG,
    client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(result.queriesIssued, 1);
  assert.equal(result.leads.length, 1);
  assert.deepEqual(result.skipped, [
    { query: 'first', reason: 'provider_error', detail: 'engines suspended' },
  ]);
});

test('a non-success status is recorded, not parsed', async () => {
  const client: RoutedSearchHttpClient = async (request) => ({
    status: 503,
    headers: { 'content-type': 'application/json' },
    bodyText: 'not json at all',
    finalUrl: request.url,
  });
  const result = await runRoutedWebSearch({
    queries: [{ query: 'x' }],
    config: SEARXNG,
    client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(result.queriesIssued, 0);
  assert.equal(result.leads.length, 0);
  assert.deepEqual(result.skipped, [
    { query: 'x', reason: 'non_success_status', detail: 'HTTP 503' },
  ]);
});

test('a run with no campaign budget says so rather than implying one was enforced', async () => {
  const { client } = scriptedClient([searxngBody([{ url: 'https://nps.gov/a' }])]);
  const result = await runRoutedWebSearch({
    queries: [{ query: 'x' }],
    config: SEARXNG,
    client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(result.budgetEnforced, false);
  assert.deepEqual(result.budgetDecisions, []);
  assert.match(describeRoutedSearch(result), /NO campaign budget enforced/u);
  assert.match(describeRoutedSearch(result), /leads are not evidence until independently fetched/u);
});

test('a campaign budget gates every query before the socket opens, and a denial stops the rest', async () => {
  const { client, requests } = scriptedClient([searxngBody([{ url: 'https://nps.gov/a' }])]);
  const result = await runRoutedWebSearch({
    queries: [{ query: 'one' }, { query: 'two' }, { query: 'three' }],
    config: SEARXNG,
    client,
    executedAt: EXECUTED_AT,
    budget: {
      policy: {
        maxQueriesPerCampaign: 2,
        monthlySpendCapUsdCents: 10_000,
        costPerQueryUsdCents: 1,
        monthlyBudgetCategory: 'research_campaign',
      },
      state: { queriesIssuedThisCampaign: 1, queriesIssuedThisMonth: 1 },
      evaluateDailyBudget: () => ({
        allowed: true,
        percentUsed: 1,
        softShutdownTriggered: false,
        hardStopTriggered: false,
      }),
    },
  });
  assert.equal(result.budgetEnforced, true);
  // The campaign cap is 2 and one query had already been issued, so exactly one more runs.
  assert.equal(result.queriesIssued, 1);
  assert.equal(requests.length, 1);
  // Both remaining queries are reported as denied, not silently dropped.
  assert.deepEqual(
    result.skipped.map((entry) => [entry.query, entry.reason]),
    [
      ['two', 'budget_denied'],
      ['three', 'budget_denied'],
    ],
  );
  assert.match(describeRoutedSearch(result), /campaign budget enforced/u);
});

test('a denied budget never opens a socket at all', async () => {
  let calls = 0;
  const client: RoutedSearchHttpClient = async () => {
    calls += 1;
    throw new Error('must not be called');
  };
  const result = await runRoutedWebSearch({
    queries: [{ query: 'one' }],
    config: SEARXNG,
    client,
    executedAt: EXECUTED_AT,
    budget: {
      policy: {
        maxQueriesPerCampaign: 1,
        monthlySpendCapUsdCents: 10_000,
        costPerQueryUsdCents: 1,
        monthlyBudgetCategory: 'research_campaign',
      },
      state: { queriesIssuedThisCampaign: 1, queriesIssuedThisMonth: 1 },
      evaluateDailyBudget: () => ({
        allowed: true,
        percentUsed: 1,
        softShutdownTriggered: false,
        hardStopTriggered: false,
      }),
    },
  });
  assert.equal(calls, 0);
  assert.equal(result.leads.length, 0);
  assert.equal(result.skipped[0]?.detail, 'campaign_query_budget_exceeded');
});

test('a SearXNG shared-secret token is sent as Authorization, and an empty one is not an error', async () => {
  const withToken = scriptedClient([searxngBody([{ url: 'https://nps.gov/a' }])]);
  await runRoutedWebSearch({
    queries: [{ query: 'x' }],
    config: { ...SEARXNG, apiKey: 'proxy-secret' },
    client: withToken.client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(withToken.requests[0]?.headers?.authorization, 'Bearer proxy-secret');

  const withoutToken = scriptedClient([searxngBody([{ url: 'https://nps.gov/a' }])]);
  await runRoutedWebSearch({
    queries: [{ query: 'x' }],
    config: SEARXNG,
    client: withoutToken.client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(withoutToken.requests[0]?.headers?.authorization, undefined);
});

test('a Brave routed search sends the key as a header and refuses an empty one', async () => {
  const brave: WebSearchProviderConfig = {
    provider: 'brave',
    apiKey: 'brave-key',
    storageTermsConfirmed: false,
    planTermsVersion: 'brave-storage-rights-tier-2026-07',
  };
  const { client, requests } = scriptedClient([
    JSON.stringify({ web: { results: [{ url: 'https://example.org/a', title: 'A' }] } }),
  ]);
  const result = await runRoutedWebSearch({
    queries: [{ query: 'x' }],
    config: brave,
    client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(result.provider, 'brave');
  assert.equal(result.leads[0]?.url, 'https://example.org/a');
  assert.equal(requests[0]?.headers?.['X-Subscription-Token'], 'brave-key');

  const keyless = scriptedClient(['{}']);
  const denied = await runRoutedWebSearch({
    queries: [{ query: 'x' }],
    config: { ...brave, apiKey: '  ' },
    client: keyless.client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(denied.skipped[0]?.reason, 'provider_error');
  assert.match(String(denied.skipped[0]?.detail), /BRAVE_SEARCH_API_KEY/u);
});

test('a SearXNG config with no base URL is refused rather than guessed', async () => {
  const { client } = scriptedClient(['{}']);
  const result = await runRoutedWebSearch({
    queries: [{ query: 'x' }],
    config: { ...SEARXNG, baseUrl: undefined },
    client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(result.skipped[0]?.reason, 'provider_error');
  assert.match(String(result.skipped[0]?.detail), /SEARXNG_BASE_URL/u);
});

test('a result row with no usable URL is dropped rather than becoming an empty lead', async () => {
  const { client } = scriptedClient([
    JSON.stringify({
      results: [{ title: 'no url here' }, { url: 'not a url' }, { url: 'https://nps.gov/ok' }],
    }),
  ]);
  const result = await runRoutedWebSearch({
    queries: [{ query: 'x' }],
    config: SEARXNG,
    client,
    executedAt: EXECUTED_AT,
  });
  assert.deepEqual(
    result.leads.map((lead) => lead.url),
    ['https://nps.gov/ok'],
  );
});

test('a blank query is skipped without being counted or reported as a failure', async () => {
  const { client, requests } = scriptedClient([searxngBody([{ url: 'https://nps.gov/a' }])]);
  const result = await runRoutedWebSearch({
    queries: [{ query: '   ' }, { query: 'real' }],
    config: SEARXNG,
    client,
    executedAt: EXECUTED_AT,
  });
  assert.equal(requests.length, 1);
  assert.equal(result.queriesIssued, 1);
  assert.deepEqual(result.skipped, []);
});
