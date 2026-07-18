/**
 * Proves the `SafeHttpClient` port (./http-port.ts) is realizable against the REAL 
 * primitives not a stub and that an SSRF-targeted URL is rejected before any adapter fetch
 * proceeds.
 *
 * `@blap/security` is a devDependency of this package for this test only (see
 * package.json); it is never imported by http-port.ts or any other shipped adapter file see
 * http-port.ts's header comment for the circular-dependency reason. This mirrors
 * `../../../map/map-source.redaction.test.ts`'s pattern exactly: the port is defined and
 * consumed with zero runtime dependency on `@blap/security`, and only the test proves the
 * real wiring holds.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateExternalUrl,
  resolveAndPinDestination,
  type PinnedTransport,
  type ResolveHost,
} from '@blap/security';
import {
  mapWithConcurrency,
  withRetry,
  type SafeHttpClient,
  type SafeHttpResponse,
} from './http-port.js';

const encoder = new TextEncoder();

async function* chunks(...values: readonly string[]): AsyncGenerator<Uint8Array> {
  for (const value of values) yield encoder.encode(value);
}

/**
 * A reference `SafeHttpClient` implementation backed by the REAL safety primitives.
 * This is what production wiring (outside this package) is expected to look like GET-only,
 * enough to prove the seam is sound; POST/header support for Wayback SPN needs a pinned
 * transport with method/body support, which is exactly why the port is generalized beyond
 * `executeSafeFetch`.
 */
function buildRealSafeHttpClient(deps: { readonly resolveHost: ResolveHost; readonly transport: PinnedTransport }): SafeHttpClient {
  return async (request): Promise<SafeHttpResponse> => {
    const parsed = evaluateExternalUrl(request.url);
    if (!parsed.allowed) {
      throw new Error(`URL rejected by BB-030 policy: ${parsed.reason}`);
    }
    const destination = await resolveAndPinDestination(parsed.value, deps.resolveHost);
    if (!destination.allowed) {
      throw new Error(`URL rejected by BB-030 DNS pinning: ${destination.reason}`);
    }
    const response = await deps.transport({
      url: destination.value.normalizedUrl,
      hostname: destination.value.hostname,
      port: destination.value.port,
      pinnedAddress: destination.value.pinnedAddress,
      headers: { host: destination.value.hostname, ...(request.headers ?? {}) },
      signal: new AbortController().signal,
    });
    const bodyChunks: string[] = [];
    for await (const chunk of response.body) {
      bodyChunks.push(new TextDecoder().decode(chunk));
    }
    return {
      status: response.status,
      headers: response.headers,
      bodyText: bodyChunks.join(''),
      finalUrl: destination.value.normalizedUrl,
    };
  };
}

test('a real BB-030-backed SafeHttpClient serves an allowed public URL', async () => {
  const client = buildRealSafeHttpClient({
    resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
    transport: async () => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      remoteAddress: '93.184.216.34',
      body: chunks('{"identifier":"example"}'),
    }),
  });

  const response = await client({ url: 'https://archive.org/metadata/example', method: 'GET' });
  assert.equal(response.status, 200);
  assert.equal(response.bodyText, '{"identifier":"example"}');
});

test('SSRF-targeted URLs (private/loopback/metadata) are rejected by the real BB-030 policy before any transport call', async () => {
  let transportCalled = false;
  const client = buildRealSafeHttpClient({
    resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
    transport: async () => {
      transportCalled = true;
      return {
        status: 200,
        headers: {},
        remoteAddress: '93.184.216.34',
        body: chunks(''),
      };
    },
  });

  for (const target of [
    'http://169.254.169.254/latest/meta-data/',
    'https://127.0.0.1/admin',
    'https://metadata.google.internal/',
    'file:///etc/passwd',
  ]) {
    await assert.rejects(() => client({ url: target, method: 'GET' }), /URL rejected by BB-030/);
  }
  assert.equal(transportCalled, false);
});

test('SSRF via DNS rebinding to a private IP is rejected even though the hostname itself is public-shaped', async () => {
  const client = buildRealSafeHttpClient({
    resolveHost: async () => [{ address: '10.0.0.5', family: 4 }],
    transport: async () => {
      throw new Error('transport must never be called for a private DNS answer');
    },
  });
  await assert.rejects(() => client({ url: 'https://internal.example.org/', method: 'GET' }), /DNS pinning/);
});

test('withRetry and mapWithConcurrency compose with the real client without live timers', async () => {
  let attempts = 0;
  const client = buildRealSafeHttpClient({
    resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
    transport: async () => {
      attempts += 1;
      if (attempts < 2) {
        return { status: 429, headers: {}, remoteAddress: '93.184.216.34', body: chunks('') };
      }
      return { status: 200, headers: { 'content-type': 'application/json' }, remoteAddress: '93.184.216.34', body: chunks('{}') };
    },
  });

  const response = await withRetry(() => client({ url: 'https://archive.org/metadata/example', method: 'GET' }), {
    retries: 3,
    baseDelayMs: 1,
    isRetryable: (res) => res?.status === 429,
    sleep: async () => {},
  });
  assert.equal(response.status, 200);
  assert.equal(attempts, 2);

  const urls = ['https://archive.org/metadata/a', 'https://archive.org/metadata/b', 'https://archive.org/metadata/c'];
  const results = await mapWithConcurrency(urls, 2, (url) => client({ url, method: 'GET' }));
  assert.equal(results.length, 3);
});
