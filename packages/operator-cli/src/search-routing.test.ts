/**
 * Provider resolution, and what happens when it cannot resolve.
 *
 * The cases that matter are the unhappy ones: a misconfigured endpoint has to produce a sentence an
 * operator can act on, and an unavailable provider has to be reported rather than thrown, so a
 * harness run with other connectors carries on.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSearchProvider, runSearchQueries } from './search-routing.ts';

test('a configured private SearXNG resolves and pins its address', async () => {
  const resolved = await resolveSearchProvider({ SEARXNG_BASE_URL: 'http://127.0.0.1:8888' });
  assert.equal(resolved.available, true);
  assert.ok(resolved.available);
  assert.equal(resolved.provider, 'searxng');
  assert.equal(resolved.pinnedAddress, '127.0.0.1');
  assert.equal(resolved.config.baseUrl, 'http://127.0.0.1:8888');
  // Leads are not persisted, so the storage-rights gate is not satisfied here on their behalf.
  assert.equal(resolved.config.storageTermsConfirmed, false);
});

test('a SearXNG shared-secret token reaches the provider config', async () => {
  const resolved = await resolveSearchProvider({
    SEARXNG_BASE_URL: 'http://127.0.0.1:8888',
    SEARXNG_AUTH_TOKEN: '  proxy-secret  ',
  });
  assert.ok(resolved.available);
  assert.equal(resolved.config.apiKey, 'proxy-secret');
});

test('SearXNG is preferred over a present Brave key', async () => {
  const resolved = await resolveSearchProvider({
    SEARXNG_BASE_URL: 'http://127.0.0.1:8888',
    BRAVE_SEARCH_API_KEY: 'brave-key',
  });
  assert.ok(resolved.available);
  assert.equal(resolved.provider, 'searxng');
});

test('an explicit Brave preference wins, and Brave carries no base URL', async () => {
  const resolved = await resolveSearchProvider({
    SEARXNG_BASE_URL: 'http://127.0.0.1:8888',
    BRAVE_SEARCH_API_KEY: 'brave-key',
    DISCOVERY_WEB_SEARCH_PROVIDER: 'brave',
  });
  assert.ok(resolved.available);
  assert.equal(resolved.provider, 'brave');
  assert.equal(resolved.config.apiKey, 'brave-key');
  assert.equal(resolved.config.baseUrl, undefined);
  // A public API is reached through DNS pinning, not through the private-endpoint client.
  assert.equal(resolved.pinnedAddress, undefined);
});

test('Brave is the fallback when no SearXNG base URL is set', async () => {
  const resolved = await resolveSearchProvider({ BRAVE_SEARCH_API_KEY: 'brave-key' });
  assert.ok(resolved.available);
  assert.equal(resolved.provider, 'brave');
});

test('a SEARXNG_BASE_URL pointing at a public address is refused with a usable reason', async () => {
  // The private-endpoint client requires a non-public address, so this is caught at resolution
  // rather than becoming a live query against someone else's server.
  const resolved = await resolveSearchProvider({ SEARXNG_BASE_URL: 'https://8.8.8.8' });
  assert.equal(resolved.available, false);
  assert.ok(!resolved.available);
  assert.match(resolved.reason, /SEARXNG_BASE_URL is set but unusable/u);
  assert.match(resolved.reason, /publicly routable/u);
});

test('a malformed SEARXNG_BASE_URL is refused rather than silently skipped', async () => {
  const resolved = await resolveSearchProvider({ SEARXNG_BASE_URL: 'not a url' });
  assert.ok(!resolved.available);
  assert.match(resolved.reason, /base_url_unparseable/u);
});

test('a Brave preference without a key names the two ways to fix it', async () => {
  const resolved = await resolveSearchProvider({
    SEARXNG_BASE_URL: 'http://127.0.0.1:8888',
    DISCOVERY_WEB_SEARCH_PROVIDER: 'brave',
  });
  assert.ok(!resolved.available);
  assert.match(resolved.reason, /BRAVE_SEARCH_API_KEY is not set/u);
  assert.match(resolved.reason, /unset the preference/u);
});

test('no configured provider at all is reported, not thrown', async () => {
  const resolved = await resolveSearchProvider({});
  assert.ok(!resolved.available);
  assert.match(resolved.reason, /No search provider configured/u);
  assert.match(resolved.reason, /SEARXNG_BASE_URL/u);
  assert.match(resolved.reason, /BRAVE_SEARCH_API_KEY/u);
});

test('runSearchQueries reports unavailability instead of failing the caller', async () => {
  const result = await runSearchQueries({
    queries: [{ query: 'anything' }],
    environment: {},
    executedAt: '2026-09-08T12:00:00.000Z',
  });
  assert.equal(result.available, false);
  assert.ok(!result.available);
  assert.match(result.reason, /No search provider configured/u);
});

test('runSearchQueries returns leads through an injected provider', async () => {
  const requests: string[] = [];
  const result = await runSearchQueries({
    queries: [{ query: '"Frederick McKinley Jones" patent', needId: 'need_1', seeking: 'patent' }],
    environment: {},
    executedAt: '2026-09-08T12:00:00.000Z',
    resolved: {
      available: true,
      provider: 'searxng',
      config: {
        provider: 'searxng',
        apiKey: '',
        storageTermsConfirmed: false,
        planTermsVersion: 'searxng-self-hosted-research-2026-07',
        baseUrl: 'http://127.0.0.1:8888',
      },
      client: async (request) => {
        requests.push(request.url);
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          bodyText: JSON.stringify({
            results: [{ url: 'https://patents.google.com/patent/US2475841', title: 'US2475841' }],
          }),
          finalUrl: request.url,
        };
      },
    },
  });
  assert.ok(result.available);
  assert.equal(result.leads.length, 1);
  assert.equal(result.leads[0]?.needId, 'need_1');
  assert.equal(result.leads[0]?.seeking, 'patent');
  assert.equal(requests.length, 1);
  assert.match(requests[0]!, /^http:\/\/127\.0\.0\.1:8888\/search\?/u);
  // Nothing in a lead set has been fetched, so nothing in it is a source yet.
  assert.equal(result.budgetEnforced, false);
});
