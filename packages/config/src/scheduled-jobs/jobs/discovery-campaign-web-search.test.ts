/**
 * Proves the web-search scheduled job completes fixture dry-runs without publishing.
 * Default provider path: SearXNG; Brave remains supported.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { WEB_SEARCH_PROVIDER_DECISION } from '../../../../domain/src/adapters/web-search/provider-decision.ts';
import {
  DISCOVERY_CAMPAIGN_WEB_SEARCH_JOB_ID,
  runDiscoveryCampaignWebSearchJob,
} from './discovery-campaign-web-search.ts';

const FIXTURE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'domain',
  'src',
  'adapters',
  'web-search',
  'fixtures',
);

const SEARXNG_FIXTURE = join(FIXTURE_ROOT, 'searxng-search-response.json');
const BRAVE_FIXTURE = join(FIXTURE_ROOT, 'brave-search-response.json');

test('web-search discovery job smoke: SearXNG fixture yields survivors', async () => {
  assert.equal(WEB_SEARCH_PROVIDER_DECISION.chosenProvider, 'searxng');
  assert.equal(WEB_SEARCH_PROVIDER_DECISION.storageTermsConfirmedInWriting, false);

  const searchResponseRaw = JSON.parse(readFileSync(SEARXNG_FIXTURE, 'utf8'));
  const result = await runDiscoveryCampaignWebSearchJob({
    jobRunId: 'web-search-run-searxng-1',
    startedAt: '2026-07-19T10:00:00.000Z',
    completedAt: '2026-07-19T10:05:00.000Z',
    searchResponseRaw,
    providerConfig: {
      provider: 'searxng',
      apiKey: '',
      storageTermsConfirmed: true,
      planTermsVersion: 'searxng-self-hosted-research-2026-07',
    },
    requireWaybackCapture: false,
  });

  assert.equal(result.run.status, 'success');
  assert.equal(result.run.jobId, DISCOVERY_CAMPAIGN_WEB_SEARCH_JOB_ID);
  assert.equal(result.run.costUnits, 1);
  assert.ok(result.campaign.yield.survivors >= 2);
  assert.equal(result.campaign.adapterId, 'searxng_search');
  assert.equal(result.campaign.kind, 'web-search-discovery.v1');
  assert.equal(result.campaign.storageTermsGate.providerDecisionConfirmedInWriting, false);
});

test('web-search discovery job still supports Brave fixture path', async () => {
  const braveResponseRaw = JSON.parse(readFileSync(BRAVE_FIXTURE, 'utf8'));
  const result = await runDiscoveryCampaignWebSearchJob({
    jobRunId: 'web-search-run-brave-1',
    startedAt: '2026-07-19T10:00:00.000Z',
    completedAt: '2026-07-19T10:05:00.000Z',
    braveResponseRaw,
    providerConfig: {
      provider: 'brave',
      apiKey: 'test-deterministic-brave-key',
      storageTermsConfirmed: true,
      planTermsVersion: 'brave-storage-rights-tier-2026-07',
    },
    requireWaybackCapture: false,
  });
  assert.equal(result.campaign.adapterId, 'brave_search');
  assert.ok(result.campaign.yield.survivors >= 2);
});

test('web-search discovery job fails closed without storageTermsConfirmed', async () => {
  const searchResponseRaw = JSON.parse(readFileSync(SEARXNG_FIXTURE, 'utf8'));
  await assert.rejects(
    () =>
      runDiscoveryCampaignWebSearchJob({
        jobRunId: 'web-search-run-fail',
        startedAt: '2026-07-19T10:00:00.000Z',
        completedAt: '2026-07-19T10:05:00.000Z',
        searchResponseRaw,
        providerConfig: {
          provider: 'searxng',
          apiKey: '',
          storageTermsConfirmed: false,
          planTermsVersion: 'searxng-self-hosted-research-2026-07',
        },
      }),
    /storageTermsConfirmed is false/,
  );
});
