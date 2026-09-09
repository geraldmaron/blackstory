/**
 * What this client must refuse.
 *
 * Every case here is a way the boundary could be wrong rather than a way it could be right, because
 * the client's whole value is that it says no: to a public address, to a second origin, to a
 * redirect, to an HTML body where JSON was promised. A test that only proves it can fetch would
 * pass against a bare `fetch`.
 *
 * No external network and no DNS. The resolver is injected, most cases must throw before a socket
 * opens at all, and the response-side controls — 3xx, content-type, byte cap — are proved against
 * an in-process server on an ephemeral 127.0.0.1 port, which is the kind of endpoint this client
 * exists for.
 */
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import {
  DEFAULT_OPERATOR_ENDPOINT_LIMITS,
  OperatorEndpointError,
  createOperatorEndpointClient,
  type ResolveHost,
} from './index.js';

/** Resolver that answers every host with one fixed address. */
const resolvesTo =
  (address: string, family: 4 | 6 = 4): ResolveHost =>
  async () => [{ address, family }];

const LOOPBACK = 'http://127.0.0.1:8888';

async function endpoint(baseUrl: string, resolveHost?: ResolveHost) {
  return createOperatorEndpointClient({
    baseUrl,
    ...(resolveHost ? { resolveHost } : {}),
  });
}

async function rejects(
  run: () => Promise<unknown>,
  reason: string,
): Promise<OperatorEndpointError> {
  try {
    await run();
  } catch (error) {
    assert.ok(
      error instanceof OperatorEndpointError,
      `expected OperatorEndpointError, got ${String(error)}`,
    );
    assert.equal(error.reason, reason);
    return error;
  }
  throw new Error(`expected rejection with reason ${reason}, but the call resolved`);
}

test('accepts the operator loopback endpoint and pins its address', async () => {
  const { origin, pinnedAddress } = await endpoint(LOOPBACK);
  assert.equal(origin, 'http://127.0.0.1:8888');
  assert.equal(pinnedAddress, '127.0.0.1');
});

test('accepts a Tailscale carrier-grade-NAT endpoint, which the SSRF policy refuses', async () => {
  const { origin, pinnedAddress } = await endpoint('http://100.119.72.84:8888');
  assert.equal(origin, 'http://100.119.72.84:8888');
  assert.equal(pinnedAddress, '100.119.72.84');
});

test('refuses a publicly routable endpoint and names the path that should be used instead', async () => {
  const error = await rejects(
    () => endpoint('https://search.example.com', resolvesTo('93.184.216.34')),
    'base_url_address_is_public',
  );
  assert.match(error.message, /resolveAndPinDestination/u);
});

test('refuses a public IP literal even when it is spelled as an IPv4-mapped IPv6 address', async () => {
  await rejects(() => endpoint('https://[::ffff:8.8.8.8]'), 'base_url_address_is_public');
  // The same folding must not reject the private form. `new URL` rewrites the dotted tail to hex,
  // so the pinned address is the normalized spelling, not the one that was typed.
  const { pinnedAddress } = await endpoint('http://[::ffff:127.0.0.1]:8888');
  assert.equal(pinnedAddress, '::ffff:7f00:1');
});

test('refuses a hostname that resolves to a public address even if one answer is private', async () => {
  // A mixed answer is a rebinding shape; one public address is enough to refuse.
  await rejects(
    () =>
      createOperatorEndpointClient({
        baseUrl: 'http://searx.internal:8888',
        resolveHost: async () => [
          { address: '10.0.0.5', family: 4 },
          { address: '93.184.216.34', family: 4 },
        ],
      }),
    'base_url_address_is_public',
  );
});

test('refuses a base URL that is not http(s), or whose origin is opaque', async () => {
  await rejects(() => endpoint('ftp://127.0.0.1:8888'), 'base_url_scheme_not_http');
  await rejects(() => endpoint('not a url'), 'base_url_unparseable');
  // Every non-special scheme serializes to the literal origin "null"; two unrelated ones would
  // otherwise compare equal.
  await rejects(() => endpoint('foo://127.0.0.1:8888'), 'base_url_scheme_not_http');
});

test('refuses a base URL carrying credentials, because URL.origin silently drops them', async () => {
  await rejects(() => endpoint('http://user:pw@127.0.0.1:8888'), 'base_url_carries_credentials');
});

test('refuses a base URL carrying a query or fragment, which would send every request to /', async () => {
  await rejects(() => endpoint('http://127.0.0.1:8888/?a=1'), 'base_url_carries_query_or_fragment');
  await rejects(() => endpoint('http://127.0.0.1:8888/#x'), 'base_url_carries_query_or_fragment');
  // An empty `?` or `#` carries nothing and `URL` drops it, so it is not an error.
  const { origin } = await endpoint('http://127.0.0.1:8888/?');
  assert.equal(origin, 'http://127.0.0.1:8888');
});

test('accepts a base URL with a path, for a reverse-proxied instance', async () => {
  // A path is not part of an origin and buildSearxngSearchUrl appends to it, so /searxng is a
  // legitimate base. The origin check must ignore the path on both sides.
  const { client, origin } = await endpoint('http://127.0.0.1:8888/searxng');
  assert.equal(origin, 'http://127.0.0.1:8888');
  await assert.rejects(
    () => client({ url: 'http://127.0.0.1:8888/searxng/search?q=x' }),
    (error: unknown) =>
      !(error instanceof OperatorEndpointError && error.reason === 'request_origin_mismatch'),
    'a path under the configured origin must pass the origin check',
  );
});

test('refuses a hostname that does not resolve', async () => {
  await rejects(
    () =>
      createOperatorEndpointClient({
        baseUrl: 'http://searx.invalid:8888',
        resolveHost: async () => {
          throw new Error('ENOTFOUND');
        },
      }),
    'base_url_resolution_failed',
  );
  await rejects(
    () =>
      createOperatorEndpointClient({
        baseUrl: 'http://searx.invalid:8888',
        resolveHost: async () => [],
      }),
    'base_url_resolution_failed',
  );
});

test('the client is GET-only', async () => {
  const { client } = await endpoint(LOOPBACK);
  await rejects(
    () => client({ url: `${LOOPBACK}/search?q=x`, method: 'POST' }),
    'request_method_not_get',
  );
});

test('the client refuses a request URL on any other origin', async () => {
  const { client } = await endpoint(LOOPBACK);
  // A different host entirely — the case that matters: a result URL handed to the wrong client.
  await rejects(
    () => client({ url: 'https://evil.example/search?q=x' }),
    'request_origin_mismatch',
  );
  // Same host, different port.
  await rejects(() => client({ url: 'http://127.0.0.1:9999/search' }), 'request_origin_mismatch');
  // Same host and port, different scheme.
  await rejects(() => client({ url: 'https://127.0.0.1:8888/search' }), 'request_origin_mismatch');
  // Credentials smuggled onto a matching origin.
  await rejects(
    () => client({ url: 'http://u:p@127.0.0.1:8888/search' }),
    'request_origin_mismatch',
  );
  // A non-http scheme.
  await rejects(() => client({ url: 'file:///etc/passwd' }), 'request_origin_mismatch');
  await rejects(() => client({ url: 'not a url' }), 'request_url_unparseable');
});

test('origin matching normalizes host case, trailing dot, brackets and implicit ports', async () => {
  const { client } = await endpoint('http://localhost', resolvesTo('127.0.0.1'));
  // Implicit port 80 on the base must equal an explicit :80 on the request, and vice versa.
  const cases = [
    'http://localhost/search?q=x',
    'http://localhost:80/search?q=x',
    'http://LOCALHOST/search?q=x',
    'http://localhost./search?q=x',
  ];
  for (const url of cases) {
    // Each of these is the SAME origin, so it gets past the origin check and fails later, at the
    // socket — never with request_origin_mismatch.
    await assert.rejects(
      () => client({ url }),
      (error: unknown) =>
        !(error instanceof OperatorEndpointError && error.reason === 'request_origin_mismatch'),
      `expected ${url} to pass the origin check`,
    );
  }
});

test('an IPv6 base accepts the bracketed request form for the same address', async () => {
  const { client, origin } = await endpoint('http://[::1]:8888');
  assert.equal(origin, 'http://::1:8888');
  await assert.rejects(
    () => client({ url: 'http://[::1]:8888/search?q=x' }),
    (error: unknown) =>
      !(error instanceof OperatorEndpointError && error.reason === 'request_origin_mismatch'),
    'bracketed IPv6 request must match an IPv6 base',
  );
});

test('limits are overridable and the defaults are the documented ones', async () => {
  assert.equal(DEFAULT_OPERATOR_ENDPOINT_LIMITS.timeoutMs, 15_000);
  assert.equal(DEFAULT_OPERATOR_ENDPOINT_LIMITS.maxResponseBytes, 4 * 1024 * 1024);
  assert.deepEqual(DEFAULT_OPERATOR_ENDPOINT_LIMITS.defaultAllowedContentTypes, [
    'application/json',
    'text/json',
  ]);
  const { client } = await createOperatorEndpointClient({
    baseUrl: LOOPBACK,
    limits: { timeoutMs: 1 },
  });
  // Nothing is listening on the loopback port in test, so this fails at the socket rather than at
  // the boundary — the point is only that a custom limit is accepted without changing the checks.
  await assert.rejects(() => client({ url: `${LOOPBACK}/search?q=x` }));
});

/**
 * The response-side controls can only be proved against a real socket, so these run an in-process
 * server on an ephemeral loopback port. Still no external network: 127.0.0.1 is the endpoint this
 * client is for, which is the point.
 */
async function withLoopbackServer<T>(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  run: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('a JSON response comes back with its body, status, headers and final URL', async () => {
  const seen: { url?: string; headers?: IncomingMessage['headers'] } = {};
  await withLoopbackServer(
    (request, response) => {
      seen.url = request.url;
      seen.headers = request.headers;
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ results: [{ url: 'https://example.org/a' }] }));
    },
    async (baseUrl) => {
      const { client } = await endpoint(baseUrl);
      const response = await client({
        url: `${baseUrl}/search?q=test&format=json`,
        headers: { authorization: 'Bearer token-abc' },
      });
      assert.equal(response.status, 200);
      assert.equal(response.finalUrl, `${baseUrl}/search?q=test&format=json`);
      assert.deepEqual(JSON.parse(response.bodyText), {
        results: [{ url: 'https://example.org/a' }],
      });
      assert.equal(seen.url, '/search?q=test&format=json');
      // The Authorization header must survive: a reverse-proxied instance needs it, and
      // executeSafeFetch hard-codes its headers and cannot carry one.
      assert.equal(seen.headers?.authorization, 'Bearer token-abc');
      assert.equal(seen.headers?.host, '127.0.0.1');
    },
  );
});

test('a redirect is refused and its Location is never followed', async () => {
  let followed = 0;
  await withLoopbackServer(
    (request, response) => {
      if (request.url?.startsWith('/search')) {
        response.writeHead(302, { location: 'http://127.0.0.1:1/elsewhere' });
        response.end();
        return;
      }
      followed += 1;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    },
    async (baseUrl) => {
      const { client } = await endpoint(baseUrl);
      await rejects(() => client({ url: `${baseUrl}/search?q=x` }), 'response_redirect');
      assert.equal(followed, 0, 'the client must not request the redirect target');
    },
  );
});

test('an HTML body where JSON was promised is refused', async () => {
  await withLoopbackServer(
    (_request, response) => {
      // The shape of a captive portal or a proxy error page: 200, but not what was asked for.
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html><body>sign in</body></html>');
    },
    async (baseUrl) => {
      const { client } = await endpoint(baseUrl);
      await rejects(
        () => client({ url: `${baseUrl}/search?q=x` }),
        'response_content_type_not_allowed',
      );
    },
  );
});

test('a response with no content-type at all is refused rather than guessed', async () => {
  await withLoopbackServer(
    (_request, response) => {
      response.writeHead(200, {});
      response.end('{}');
    },
    async (baseUrl) => {
      const { client } = await endpoint(baseUrl);
      await rejects(
        () => client({ url: `${baseUrl}/search?q=x` }),
        'response_content_type_not_allowed',
      );
    },
  );
});

test('the caller may widen the content-type allowlist for one request', async () => {
  await withLoopbackServer(
    (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('ok');
    },
    async (baseUrl) => {
      const { client } = await endpoint(baseUrl);
      const response = await client({
        url: `${baseUrl}/healthz`,
        allowedContentTypes: ['text/plain'],
      });
      assert.equal(response.bodyText, 'ok');
    },
  );
});

test('a body over the byte cap is cut off rather than buffered', async () => {
  await withLoopbackServer(
    (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      // Well past the cap set below, written in chunks so the limit trips mid-stream.
      for (let index = 0; index < 40; index += 1) response.write('x'.repeat(1024));
      response.end();
    },
    async (baseUrl) => {
      const { client } = await createOperatorEndpointClient({
        baseUrl,
        limits: { maxResponseBytes: 2048 },
      });
      await rejects(() => client({ url: `${baseUrl}/search?q=x` }), 'response_too_large');
    },
  );
});

test('a 500 from the endpoint is returned, not thrown: the caller decides what it means', async () => {
  await withLoopbackServer(
    (_request, response) => {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end('{"error":"engines down"}');
    },
    async (baseUrl) => {
      const { client } = await endpoint(baseUrl);
      const response = await client({ url: `${baseUrl}/search?q=x` });
      assert.equal(response.status, 500);
    },
  );
});

test('the client makes exactly one request and never retries', async () => {
  let requests = 0;
  await withLoopbackServer(
    (_request, response) => {
      requests += 1;
      // 503 is the status a retry loop would chase; corroborate-source's 4s spacing exists because
      // bursts suspend upstream engines, so retry policy belongs to the caller, not here.
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end('{}');
    },
    async (baseUrl) => {
      const { client } = await endpoint(baseUrl);
      const response = await client({ url: `${baseUrl}/search?q=x` });
      assert.equal(response.status, 503);
      assert.equal(requests, 1);
    },
  );
});
