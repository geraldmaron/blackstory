/**
 * Unit tests for the browser-safe `/locate/api` fetch wrapper, against a stubbed global
 * `fetch` no real network call, no DOM environment required.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchLocateByAddress, fetchLocateByCoordinates } from './locate-client';

function stubFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    ({
      status,
      json: async () => body,
    }) as Response) as typeof fetch;
}

test('maps a 200 ok:true response to kind:"resolved"', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = stubFetch(200, {
    ok: true,
    cacheHit: false,
    resolution: {
      match: { stateName: 'District of Columbia' },
      jurisdictionIds: { countryId: 'us', stateId: 'us-11' },
      precision: { tier: 'state', exactCoordinatesRetained: false },
    },
  });
  try {
    const result = await fetchLocateByAddress('4600 Silver Hill Rd');
    assert.equal(result.kind, 'resolved');
    if (result.kind === 'resolved') {
      assert.equal(result.resolution.jurisdictionIds.stateId, 'us-11');
      assert.equal(result.cacheHit, false);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test('maps a 200 ok:false response to kind:"fallback"', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = stubFetch(200, {
    ok: false,
    fallback: { available: true, reason: 'no_match', message: 'no match', searchHref: '/search' },
  });
  try {
    const result = await fetchLocateByCoordinates(38.846, -76.927);
    assert.equal(result.kind, 'fallback');
  } finally {
    globalThis.fetch = original;
  }
});

test('maps a 401 to kind:"app_check_denied"', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = stubFetch(401, { error: 'app_check_required', reason: 'missing_token' });
  try {
    const result = await fetchLocateByAddress('123 Main St');
    assert.equal(result.kind, 'app_check_denied');
  } finally {
    globalThis.fetch = original;
  }
});

test('maps a 429 to kind:"rate_limited" and carries retryAfterSec', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = stubFetch(429, { error: 'rate_limit_exceeded', retryAfterSec: 15 });
  try {
    const result = await fetchLocateByAddress('123 Main St');
    assert.equal(result.kind, 'rate_limited');
    if (result.kind === 'rate_limited') {
      assert.equal(result.retryAfterSec, 15);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test('maps a 400 to kind:"invalid_query" carrying the reason', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = stubFetch(400, { error: 'invalid_locate_query', reason: 'empty_address' });
  try {
    const result = await fetchLocateByAddress('');
    assert.equal(result.kind, 'invalid_query');
    if (result.kind === 'invalid_query') {
      assert.equal(result.reason, 'empty_address');
    }
  } finally {
    globalThis.fetch = original;
  }
});

test('maps a thrown fetch (network failure) to kind:"network_error"', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('offline');
  }) as typeof fetch;
  try {
    const result = await fetchLocateByAddress('123 Main St');
    assert.equal(result.kind, 'network_error');
  } finally {
    globalThis.fetch = original;
  }
});

test('sends the provided App Check headers on the outgoing request', async () => {
  const original = globalThis.fetch;
  let capturedHeaders: HeadersInit | undefined;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    capturedHeaders = init?.headers;
    return { status: 200, json: async () => ({ ok: false, fallback: { available: true, reason: 'no_match', message: 'x', searchHref: '/search' } }) } as Response;
  }) as typeof fetch;
  try {
    await fetchLocateByAddress('123 Main St', { 'X-Firebase-AppCheck': 'token-123' });
    assert.deepEqual(capturedHeaders, { 'X-Firebase-AppCheck': 'token-123' });
  } finally {
    globalThis.fetch = original;
  }
});

test('forCamera appends camera=1 on the address locate request URL', async () => {
  const original = globalThis.fetch;
  let capturedUrl = '';
  globalThis.fetch = (async (url: string) => {
    capturedUrl = url;
    return {
      status: 200,
      json: async () => ({
        ok: false,
        fallback: { available: true, reason: 'no_match', message: 'x', searchHref: '/search' },
      }),
    } as Response;
  }) as typeof fetch;
  try {
    await fetchLocateByAddress('Washington, DC', {}, { forCamera: true });
    assert.match(capturedUrl, /\/locate\/api\?/);
    assert.match(capturedUrl, /camera=1/);
    assert.match(capturedUrl, /address=Washington/);
  } finally {
    globalThis.fetch = original;
  }
});

test('forCamera appends camera=1 on coordinate locate request URL', async () => {
  const original = globalThis.fetch;
  let capturedUrl = '';
  globalThis.fetch = (async (url: string) => {
    capturedUrl = url;
    return {
      status: 200,
      json: async () => ({
        ok: false,
        fallback: { available: true, reason: 'no_match', message: 'x', searchHref: '/search' },
      }),
    } as Response;
  }) as typeof fetch;
  try {
    await fetchLocateByCoordinates(26.7, -80.0, {}, { forCamera: true });
    assert.match(capturedUrl, /\/locate\/api\?/);
    assert.match(capturedUrl, /camera=1/);
    assert.match(capturedUrl, /lat=26\.7/);
    assert.match(capturedUrl, /lng=-80/);
  } finally {
    globalThis.fetch = original;
  }
});
