/**
 * Exercises URL parsing, IP classification, DNS pinning, redirects, resource
 * limits, parser quarantine, and the asynchronous queue contract without network I/O.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createUrlEvaluationJob,
  evaluateExternalUrl,
  executeSafeFetch,
  isPublicIpAddress,
  transitionUrlEvaluation,
  type PinnedTransport,
  type PinnedTransportResponse,
  type ResolveHost,
} from './index.ts';

const PUBLIC_V4 = '93.184.216.34';
const PUBLIC_V6 = '2606:2800:220:1:248:1893:25c8:1946';
const encoder = new TextEncoder();

async function* chunks(...values: readonly string[]): AsyncGenerator<Uint8Array> {
  for (const value of values) yield encoder.encode(value);
}

function response(overrides: Partial<PinnedTransportResponse> = {}): PinnedTransportResponse {
  return {
    status: 200,
    headers: { 'content-type': 'text/plain' },
    remoteAddress: PUBLIC_V4,
    body: chunks('public evidence'),
    ...overrides,
  };
}

const publicResolver: ResolveHost = async () => [{ address: PUBLIC_V4, family: 4 }];

test('permits only HTTP(S), rejects user-info, disallowed ports, and source-domain violations', () => {
  assert.equal(evaluateExternalUrl('https://example.org/path#fragment').allowed, true);
  assert.equal(evaluateExternalUrl('http://example.org/path').allowed, true);
  for (const [url, reason] of [
    ['file:///etc/passwd', 'scheme_not_allowed'],
    ['gopher://example.org/', 'scheme_not_allowed'],
    ['https://user:secret@example.org/', 'userinfo_not_allowed'],
    ['https://example.org:22/', 'port_not_allowed'],
    ['https://metadata.google.internal/', 'domain_not_allowed'],
  ] as const) {
    const result = evaluateExternalUrl(url);
    assert.equal(result.allowed, false, url);
    if (!result.allowed) assert.equal(result.reason, reason);
  }
  const denied = evaluateExternalUrl('https://cdn.example.org/', {
    deniedDomains: ['example.org'],
  });
  assert.deepEqual(denied, { allowed: false, reason: 'domain_not_allowed' });
  const notAllowed = evaluateExternalUrl('https://other.test/', {
    allowedDomains: ['example.org'],
  });
  assert.deepEqual(notAllowed, { allowed: false, reason: 'domain_not_allowed' });
});

test('rejects private, loopback, link-local, metadata, multicast, and reserved IPv4', () => {
  const blocked = [
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '192.0.2.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
  ];
  for (const address of blocked) assert.equal(isPublicIpAddress(address), false, address);
  assert.equal(isPublicIpAddress(PUBLIC_V4), true);
});

test('rejects private IPv6 and IPv4-mapped addresses while permitting global IPv6', () => {
  for (const address of ['::', '::1', 'fc00::1', 'fe80::1', 'ff02::1', '2001:db8::1']) {
    assert.equal(isPublicIpAddress(address), false, address);
  }
  assert.equal(isPublicIpAddress('::ffff:127.0.0.1'), false);
  assert.equal(isPublicIpAddress('::ffff:169.254.169.254'), false);
  assert.equal(isPublicIpAddress(PUBLIC_V6), true);
});

test('WHATWG normalization exposes encoded IPv4 forms before policy evaluation', async () => {
  for (const url of [
    'http://2130706433/',
    'http://0x7f000001/',
    'http://0177.0.0.1/',
    'http://127.1/',
  ]) {
    const result = await executeSafeFetch(url, {
      resolveHost: publicResolver,
      transport: async () => response(),
    });
    assert.equal(result.ok, false, url);
    if (!result.ok) assert.equal(result.reason, 'dns_answer_not_public');
  }
});

test('fails closed on mixed DNS answers and a connected address that differs from the pin', async () => {
  const mixed = await executeSafeFetch('https://example.org/', {
    resolveHost: async () => [
      { address: PUBLIC_V4, family: 4 },
      { address: '127.0.0.1', family: 4 },
    ],
    transport: async () => response(),
  });
  assert.deepEqual(mixed, {
    ok: false,
    reason: 'dns_answer_not_public',
    quarantineState: 'rejected',
    publicationAllowed: false,
  });

  const rebound = await executeSafeFetch('https://example.org/', {
    resolveHost: publicResolver,
    transport: async () => response({ remoteAddress: '10.0.0.7' }),
  });
  assert.equal(rebound.ok, false);
  if (!rebound.ok) assert.equal(rebound.reason, 'connected_address_mismatch');
});

test('revalidates every redirect and rejects a redirect to cloud metadata', async () => {
  let transportCalls = 0;
  const transport: PinnedTransport = async () => {
    transportCalls += 1;
    return response({
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    });
  };
  const result = await executeSafeFetch('https://example.org/', {
    resolveHost: publicResolver,
    transport,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'dns_answer_not_public');
  assert.equal(transportCalls, 1);
});

test('re-resolves redirect hostnames and enforces redirect count', async () => {
  const resolved: string[] = [];
  const resolver: ResolveHost = async (hostname) => {
    resolved.push(hostname);
    return [{ address: PUBLIC_V4, family: 4 }];
  };
  let calls = 0;
  const result = await executeSafeFetch(
    'https://one.example/',
    {
      resolveHost: resolver,
      transport: async () => {
        calls += 1;
        return response({
          status: 302,
          headers: { location: `https://hop${calls}.example/` },
        });
      },
    },
    { limits: { maxRedirects: 2 } },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'redirect_limit_exceeded');
  assert.deepEqual(resolved, ['one.example', 'hop1.example', 'hop2.example']);
});

test('terminates declared and streamed oversized responses', async () => {
  const declared = await executeSafeFetch(
    'https://example.org/',
    {
      resolveHost: publicResolver,
      transport: async () =>
        response({ headers: { 'content-type': 'text/plain', 'content-length': '100' } }),
    },
    { limits: { maxResponseBytes: 10 } },
  );
  assert.equal(declared.ok, false);
  if (!declared.ok) assert.equal(declared.reason, 'response_too_large');

  const streamed = await executeSafeFetch(
    'https://example.org/',
    {
      resolveHost: publicResolver,
      transport: async () => response({ body: chunks('123456', '789012') }),
    },
    { limits: { maxResponseBytes: 10 } },
  );
  assert.equal(streamed.ok, false);
  if (!streamed.ok) assert.equal(streamed.reason, 'response_too_large');
});

test('terminates slow responses and blocks disallowed content types', async () => {
  const slow = await executeSafeFetch(
    'https://example.org/',
    {
      resolveHost: publicResolver,
      transport: async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return response();
      },
    },
    { limits: { maxDurationMs: 5 } },
  );
  assert.equal(slow.ok, false);
  if (!slow.ok) assert.equal(slow.reason, 'duration_exceeded');

  const binary = await executeSafeFetch('https://example.org/', {
    resolveHost: publicResolver,
    transport: async () => response({ headers: { 'content-type': 'application/octet-stream' } }),
  });
  assert.equal(binary.ok, false);
  if (!binary.ok) assert.equal(binary.reason, 'content_type_not_allowed');
});

test('hashes safe content but rejects active or malware-indicated content', async () => {
  const safe = await executeSafeFetch('https://example.org/', {
    resolveHost: publicResolver,
    transport: async () => response(),
  });
  assert.equal(safe.ok, true);
  if (safe.ok) {
    assert.match(safe.contentHash, /^[\da-f]{64}$/u);
    assert.equal(safe.quarantineState, 'validated');
    assert.equal(safe.publicationAllowed, false);
  }

  const active = await executeSafeFetch('https://example.org/', {
    resolveHost: publicResolver,
    transport: async () =>
      response({
        headers: { 'content-type': 'text/html' },
        body: chunks('<html><script>alert(1)</script></html>'),
      }),
  });
  assert.equal(active.ok, false);
  if (!active.ok) assert.equal(active.reason, 'malware_indicator');
});

test('submission path creates a queue contract and validation never publishes directly', () => {
  const job = createUrlEvaluationJob(
    'submission-1',
    'https://example.org/source',
    Date.parse('2026-07-17T00:00:00Z'),
  );
  assert.equal(job.fetchDuringSubmissionRequest, false);
  assert.equal(job.state, 'queued');
  assert.equal(job.canonicalWriteAllowed, false);

  const fetching = transitionUrlEvaluation(
    {
      jobId: job.id,
      state: 'queued',
      quarantineRequired: true,
      canonicalWriteAllowed: false,
      publicationAllowed: false,
    },
    'fetching',
  );
  const validating = transitionUrlEvaluation(fetching, 'validating');
  const validated = transitionUrlEvaluation(validating, 'validated', {
    contentHash: 'a'.repeat(64),
    malwareIndicators: [],
  });
  assert.equal(validated.quarantineRequired, true);
  assert.equal(validated.publicationAllowed, false);
  assert.throws(() => transitionUrlEvaluation(validated, 'fetching'));
});
