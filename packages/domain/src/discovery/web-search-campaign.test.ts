/**
 * Integration tests: Brave web-search discovery campaign (fail-closed, fixture-first).
 *
 * Proves storage-terms gate, fixture survivors, 50-request cap, provider-decision invariant,
 * and optional editorial mock — without live HTTP or fabricated Wayback captures.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  WEB_SEARCH_PROVIDER_DECISION,
  type WebSearchProviderConfig,
} from '../adapters/web-search/index.js';
import { buildQueryPack } from '../query-packs/index.js';
import {
  assertWebSearchCampaignStorageTerms,
  runWebSearchCampaign,
  WEB_SEARCH_CAMPAIGN_KIND,
  WEB_SEARCH_MAX_REQUESTS_PER_RUN,
} from './web-search-campaign.js';

const FIXED_NOW = '2026-07-18T22:00:00.000Z';
const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'adapters',
  'web-search',
  'fixtures',
  'brave-search-response.json',
);
const FAKE_API_KEY = 'test-deterministic-brave-key';

function loadBraveFixture(): unknown {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

function unconfirmedConfig(): WebSearchProviderConfig {
  return {
    provider: 'brave',
    apiKey: FAKE_API_KEY,
    storageTermsConfirmed: false,
    planTermsVersion: 'brave-storage-rights-tier-2026-07',
  };
}

function confirmedConfig(): WebSearchProviderConfig {
  return { ...unconfirmedConfig(), storageTermsConfirmed: true };
}

function baseInput(
  overrides: Partial<Parameters<typeof runWebSearchCampaign>[0]> = {},
): Parameters<typeof runWebSearchCampaign>[0] {
  return {
    providerConfig: confirmedConfig(),
    braveResponseRaw: loadBraveFixture(),
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    requireWaybackCapture: false,
    ...overrides,
  };
}

test('fail closed without storageTermsConfirmed — campaign throws before survivors', async () => {
  assert.throws(
    () => assertWebSearchCampaignStorageTerms(unconfirmedConfig()),
    /storageTermsConfirmed is false/,
  );
  await assert.rejects(
    () =>
      runWebSearchCampaign(
        baseInput({
          providerConfig: unconfirmedConfig(),
        }),
      ),
    /storageTermsConfirmed is false/,
  );
});

test('fixture with storageTermsConfirmed true yields survivors from brave-search-response.json', async () => {
  const result = await runWebSearchCampaign(baseInput());
  assert.equal(result.kind, WEB_SEARCH_CAMPAIGN_KIND);
  assert.equal(result.adapterId, 'brave_search');
  assert.ok(result.yield.survivors >= 2, `expected survivors, got ${result.yield.survivors}`);
  assert.equal(result.rejectedResultCount, 1);
  assert.equal(result.waybackGate, 'deferred');
  assert.equal(result.storageTermsGate.confirmedAtRunTime, true);
  assert.equal(result.requestBudget.requestsIssued, 1);
  assert.match(result.queryText, /Alabama|Montgomery|freedom rider/i);

  const titles = result.campaign.candidates
    .filter((c) => c.status === 'accepted' || c.status === 'merged')
    .map((c) => c.adapterRecord.title ?? '');
  assert.ok(titles.some((t) => t.includes('Piedmont County')));
  assert.ok(titles.some((t) => t.includes('grandmother')));
});

test('SearXNG fixture campaign yields survivors and uses searxng_search adapter', async () => {
  const searxngPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'adapters',
    'web-search',
    'fixtures',
    'searxng-search-response.json',
  );
  const result = await runWebSearchCampaign({
    providerConfig: {
      provider: 'searxng',
      apiKey: '',
      storageTermsConfirmed: true,
      planTermsVersion: 'searxng-self-hosted-research-2026-07',
      baseUrl: 'http://100.119.72.84:8888',
    },
    searchResponseRaw: JSON.parse(readFileSync(searxngPath, 'utf8')),
    stampedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    requireWaybackCapture: false,
  });
  assert.equal(result.adapterId, 'searxng_search');
  assert.ok(result.yield.survivors >= 2);
  assert.equal(result.rejectedResultCount, 1);
  assert.equal(WEB_SEARCH_PROVIDER_DECISION.chosenProvider, 'searxng');
});

test('cap 50 honored — query planning truncates at roster max', async () => {
  const pack = buildQueryPack({
    id: 'qp-cap-test',
    displayName: 'Cap test',
    entityKind: 'person',
    theme: 'civil_rights',
    semver: '1.0.0',
    createdAt: FIXED_NOW,
    terms: [
      { text: 'freedom rider', termClass: 'positive' },
      { text: 'Alabama', termClass: 'geographic' },
    ],
  });
  const seeds = Array.from({ length: 60 }, (_, index) => ({
    state: 'Alabama',
    county: `County${index}`,
  }));

  const result = await runWebSearchCampaign(
    baseInput({
      pack,
      geographicSeeds: seeds,
      maxQueries: WEB_SEARCH_MAX_REQUESTS_PER_RUN,
    }),
  );

  assert.equal(result.requestBudget.maxRequestsPerRun, 50);
  assert.equal(result.requestBudget.queriesPlanned, 60);
  assert.equal(result.requestBudget.queriesExecuted, 1);
  assert.equal(result.requestBudget.requestsIssued, 1);
  assert.equal(result.requestBudget.capApplied, true);
});

test('provider-decision still has storageTermsConfirmedInWriting === false', () => {
  assert.equal(WEB_SEARCH_PROVIDER_DECISION.storageTermsConfirmedInWriting, false);
  assert.equal(WEB_SEARCH_PROVIDER_DECISION.chosenProvider, 'searxng');
});

test('requireWaybackCapture default marks required_unmet without inventing captures', async () => {
  const result = await runWebSearchCampaign(
    baseInput({
      requireWaybackCapture: true,
    }),
  );
  assert.equal(result.waybackGate, 'required_unmet');
  assert.ok(result.yield.survivors >= 1);
});

test('optional editorial mock reviews top survivors without publishing', async () => {
  const result = await runWebSearchCampaign(
    baseInput({
      editorialHook: {
        reviewTopN: 2,
        review: (leads) =>
          leads.map((lead) => ({
            candidateId: lead.candidateId,
            decision: 'keep' as const,
            reason: 'mock editorial keep',
          })),
      },
    }),
  );
  assert.ok(result.editorialReviews);
  assert.ok(result.editorialReviews!.length >= 1);
  assert.equal(result.editorialReviews![0]?.decision, 'keep');
});

test('maxQueries above roster cap is rejected', async () => {
  await assert.rejects(
    () =>
      runWebSearchCampaign(
        baseInput({
          maxQueries: 51,
        }),
      ),
    /cannot exceed roster cap/,
  );
});
