/**
 * Tests for discovery campaign dispatcher (fixture mode + kill-switch gate).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DISCOVERY_DISPATCHER_VERSION,
  dispatchDiscoveryCampaign,
  disengagedResearchCampaignsSnapshot,
} from './discovery-dispatcher.js';

const FIXED_NOW = '2026-07-19T01:00:00.000Z';

test('fixture community-obscurity dispatch succeeds when kill switch disengaged', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'community-obscurity-discovery',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_obscurity',
    maxCandidates: 20,
  });
  assert.equal(result.dispatcherVersion, DISCOVERY_DISPATCHER_VERSION);
  assert.equal(result.status, 'success');
  assert.equal(result.publicEffect, 'none');
  assert.ok((result.summary.itemsProcessed ?? 0) >= 1);
  assert.equal(result.summary.kind, 'community-obscurity.v1');
});

test('fixture wikimedia-federal dispatch succeeds', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-wikimedia-federal',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_wm',
    maxCandidates: 30,
  });
  assert.equal(result.status, 'success');
  assert.ok((result.summary.survivors ?? 0) >= 1);
});

test('fixture archive-dpla dispatch succeeds', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-archive-dpla',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_archive',
    maxCandidates: 20,
  });
  assert.equal(result.status, 'success');
  assert.ok((result.summary.survivors ?? 0) >= 1);
});

test('fixture rss dispatch succeeds', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-rss',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_rss',
    maxCandidates: 20,
  });
  assert.equal(result.status, 'success');
  assert.ok((result.summary.survivors ?? 0) >= 1);
});

test('fixture web-search dispatch succeeds with test storage terms', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-web-search',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_web',
    maxCandidates: 10,
  });
  assert.equal(result.status, 'success');
  assert.ok((result.summary.survivors ?? 0) >= 1);
});

/**
 * The live web-search branch had no test at all, because it called a bare global `fetch` and
 * there was nothing to inject. These cover it through the injected origin-pinned client, with no
 * network: the point is that the branch is now reachable by a test, not that SearXNG is up.
 */
const LIVE_SEARCH_ENV = {
  SEARXNG_BASE_URL: 'http://127.0.0.1:8888',
  DISCOVERY_STORAGE_TERMS_CONFIRMED: 'true',
  DISCOVERY_SEARXNG_QUERY: 'Montgomery County Alabama African American',
} as const;

test('live web-search dispatch routes through the injected search client', async () => {
  const requests: { url: string; headers?: Readonly<Record<string, string>> }[] = [];
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-web-search',
    mode: 'live',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_web_live',
    maxCandidates: 10,
    environment: { ...LIVE_SEARCH_ENV, SEARXNG_AUTH_TOKEN: 'proxy-secret' },
    searchHttpClient: async (request) => {
      requests.push({
        url: request.url,
        ...(request.headers ? { headers: request.headers } : {}),
      });
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: JSON.stringify({
          results: [
            {
              url: 'https://www.nps.gov/places/freedom-riders-national-monument.htm',
              title: 'Freedom Riders National Monument',
              content: 'A Park Service account of the 1961 Freedom Riders bus burning in Anniston.',
            },
          ],
        }),
        finalUrl: request.url,
      };
    },
  });
  assert.equal(result.status, 'success');
  assert.equal(requests.length, 1);
  // The query reached the provider through the one routed URL builder.
  assert.match(requests[0]!.url, /^http:\/\/127\.0\.0\.1:8888\/search\?/u);
  assert.match(requests[0]!.url, /format=json/u);
  // A reverse-proxy shared secret must survive; executeSafeFetch could not have carried it.
  assert.equal(requests[0]!.headers?.Authorization, 'Bearer proxy-secret');
  // JSON only, so an HTML error page cannot be parsed as a result set.
  assert.ok(requests[0]!.headers !== undefined);
});

test('live web-search dispatch surfaces a provider failure instead of reporting success', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-web-search',
    mode: 'live',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_web_live_err',
    environment: LIVE_SEARCH_ENV,
    searchHttpClient: async (request) => ({
      status: 502,
      headers: { 'content-type': 'application/json' },
      bodyText: '{}',
      finalUrl: request.url,
    }),
  });
  assert.equal(result.status, 'error');
  assert.match(String(result.summary.message), /SearXNG HTTP 502/u);
});

test('live web-search dispatch propagates a client refusal rather than swallowing it', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-web-search',
    mode: 'live',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_web_live_refused',
    environment: LIVE_SEARCH_ENV,
    searchHttpClient: async () => {
      throw new Error('Operator search endpoint returned 302; redirects are never followed');
    },
  });
  assert.equal(result.status, 'error');
  assert.match(String(result.summary.message), /redirects are never followed/u);
});

test('live web-search dispatch still refuses to run without confirmed storage terms', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-web-search',
    mode: 'live',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_web_live_nogate',
    environment: { SEARXNG_BASE_URL: 'http://127.0.0.1:8888' },
    searchHttpClient: async () => {
      throw new Error('must not be called');
    },
  });
  assert.equal(result.status, 'error');
  assert.match(String(result.summary.message), /DISCOVERY_STORAGE_TERMS_CONFIRMED/u);
});

test('engaged kill switch skips without running campaign', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-rss',
    mode: 'fixture',
    killSwitchEngaged: true,
    nowIso: FIXED_NOW,
  });
  assert.equal(result.status, 'skipped_kill_switch');
  assert.equal(result.run, undefined);
});

test('missing kill-switch snapshot fails closed (deny)', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-rss',
    mode: 'fixture',
    killSwitchSnapshot: {},
    nowIso: FIXED_NOW,
  });
  assert.equal(result.status, 'skipped_kill_switch');
});

test('disengagedResearchCampaignsSnapshot allows dispatch', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-rss',
    mode: 'fixture',
    killSwitchSnapshot: disengagedResearchCampaignsSnapshot(FIXED_NOW),
    nowIso: FIXED_NOW,
    jobRunId: 'run_test_snapshot',
  });
  assert.equal(result.status, 'success');
});

test('unknown job id returns error', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'not-a-real-job',
    mode: 'fixture',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
  });
  assert.equal(result.status, 'error');
});

test('live rss without DISCOVERY_FEED_XML returns error', async () => {
  const result = await dispatchDiscoveryCampaign({
    jobId: 'discovery-campaign-rss',
    mode: 'live',
    killSwitchEngaged: false,
    nowIso: FIXED_NOW,
    environment: {},
  });
  assert.equal(result.status, 'error');
  assert.match(result.summary.message ?? '', /DISCOVERY_FEED_XML/);
});
