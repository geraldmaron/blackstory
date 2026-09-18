/** Tests use injected HTTP responses; no submission reaches Internet Archive. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { SafeHttpRequest, SafeHttpResponse } from '../shared/http-port.js';
import {
  buildWaybackCaptureUrl,
  lookupWaybackSnapshot,
  parseSpnStatusResponse,
  parseWaybackAvailabilityResponse,
  parseWaybackCaptureUrl,
  pollSpnStatus,
  submitSpnCapture,
  waybackAvailabilityUrl,
  waybackSpnStatusUrl,
  WAYBACK_AVAILABILITY_URL,
  WAYBACK_SPN_SUBMIT_URL,
  type SpnCredentials,
} from './index.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const CREDENTIALS: SpnCredentials = { accessKey: 'test-access-key', secretKey: 'test-secret-key' };

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as T;
}

function jsonResponse(body: unknown, status = 200): SafeHttpResponse {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    bodyText: JSON.stringify(body),
    finalUrl: '',
  };
}

test('submitSpnCapture sends an authenticated POST and returns the job id', async () => {
  const requests: SafeHttpRequest[] = [];
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    requests.push(request);
    return jsonResponse(loadFixture('spn-submit-response.json'));
  };

  const result = await submitSpnCapture(client, CREDENTIALS, 'https://example.org/article');
  assert.equal(result.jobId, 'spn2-job-abc123');
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, WAYBACK_SPN_SUBMIT_URL);
  assert.equal(requests[0]?.method, 'POST');
  assert.equal(requests[0]?.headers?.authorization, 'LOW test-access-key:test-secret-key');
  assert.match(requests[0]?.body ?? '', /url=https%3A%2F%2Fexample\.org%2Farticle/);
});

test('submitSpnCapture requires non-empty credentials', async () => {
  const client = async (): Promise<SafeHttpResponse> =>
    jsonResponse(loadFixture('spn-submit-response.json'));
  await assert.rejects(
    () => submitSpnCapture(client, { accessKey: '', secretKey: '' }, 'https://example.org/x'),
    /credentials/,
  );
});

test('parseSpnStatusResponse is defensive against malformed payloads', () => {
  assert.equal(parseSpnStatusResponse(null).status, 'error');
  assert.equal(parseSpnStatusResponse({ status: 'not-a-real-status' }).status, 'error');
  assert.equal(parseSpnStatusResponse(loadFixture('spn-status-success.json')).status, 'success');
  assert.equal(
    parseSpnStatusResponse(loadFixture('spn-status-success.json')).timestamp,
    '20260717140512',
  );
});

test('pollSpnStatus polls through pending states and returns on success (injectable sleep, no real timers)', async () => {
  const responses = [
    loadFixture('spn-status-pending.json'),
    loadFixture('spn-status-pending.json'),
    loadFixture('spn-status-success.json'),
  ];
  let callIndex = 0;
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    assert.equal(request.url, waybackSpnStatusUrl('spn2-job-abc123'));
    const response = jsonResponse(responses[callIndex]);
    callIndex += 1;
    return response;
  };
  const sleeps: number[] = [];
  const result = await pollSpnStatus(client, 'spn2-job-abc123', {
    maxAttempts: 5,
    delayMs: 1000,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  assert.equal(result.status, 'success');
  assert.equal(callIndex, 3);
  assert.deepEqual(sleeps, [1000, 1000]);
});

test('pollSpnStatus preserves pending status after its poll budget', async () => {
  const client = async (): Promise<SafeHttpResponse> =>
    jsonResponse(loadFixture('spn-status-pending.json'));
  const result = await pollSpnStatus(client, 'spn2-job-stuck', {
    maxAttempts: 3,
    delayMs: 10,
    sleep: async () => {},
  });
  assert.equal(result.status, 'pending');
  assert.equal(result.message, 'poll_budget_exhausted');
});

test('buildWaybackCaptureUrl matches the archive.org web/<timestamp>/<url> pattern', () => {
  const url = buildWaybackCaptureUrl('20260717140512', 'https://example.org/article');
  assert.equal(url, 'https://web.archive.org/web/20260717140512/https://example.org/article');
});

// ---- availability lookup ----

test('waybackAvailabilityUrl encodes the target and only sets timestamp when given', () => {
  assert.equal(
    waybackAvailabilityUrl('https://example.org/a b?x=1'),
    `${WAYBACK_AVAILABILITY_URL}?url=https%3A%2F%2Fexample.org%2Fa+b%3Fx%3D1`,
  );
  assert.equal(
    waybackAvailabilityUrl('https://example.org/a', '20260214093311'),
    `${WAYBACK_AVAILABILITY_URL}?url=https%3A%2F%2Fexample.org%2Fa&timestamp=20260214093311`,
  );
  assert.equal(
    waybackAvailabilityUrl('https://example.org/a', '   '),
    `${WAYBACK_AVAILABILITY_URL}?url=https%3A%2F%2Fexample.org%2Fa`,
    'a blank timestamp must not become an empty query parameter',
  );
});

test('lookupWaybackSnapshot returns the pointer the API named, upgraded to https', async () => {
  const requests: SafeHttpRequest[] = [];
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    requests.push(request);
    return jsonResponse(loadFixture('availability-hit.json'));
  };

  const result = await lookupWaybackSnapshot(
    client,
    'https://www.piedmonthistoricalsociety.example.org/news/freedmens-bureau-correspondence',
  );
  assert.equal(result.status, 'found');
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.method, 'GET');
  assert.ok(requests[0]?.url.startsWith(WAYBACK_AVAILABILITY_URL));
  if (result.status !== 'found') return;
  // The fixture answers in http, as the live API does; the stored pointer must be https.
  assert.equal(
    result.snapshot.url,
    'https://web.archive.org/web/20260214093311/https://www.piedmonthistoricalsociety.example.org/news/freedmens-bureau-correspondence',
  );
  assert.equal(result.snapshot.timestamp, '20260214093311');
  assert.equal(result.snapshot.httpStatus, '200');
});

test('lookupWaybackSnapshot reports an empty archived_snapshots as a plain no_snapshot miss', async () => {
  const client = async (): Promise<SafeHttpResponse> =>
    jsonResponse(loadFixture('availability-miss.json'));
  const result = await lookupWaybackSnapshot(client, 'https://gazette.example.org/1948/inquest');
  assert.equal(result.status, 'miss');
  if (result.status !== 'miss') return;
  assert.equal(result.reason, 'no_snapshot');
});

test('lookupWaybackSnapshot turns an archive 5xx into a miss rather than a throw', async () => {
  let calls = 0;
  const client = async (): Promise<SafeHttpResponse> => {
    calls += 1;
    return {
      status: 503,
      headers: { 'content-type': 'application/json' },
      bodyText: '',
      finalUrl: '',
    };
  };
  const result = await lookupWaybackSnapshot(client, 'https://example.org/a', {
    retries: 1,
    sleep: async () => {},
  });
  assert.equal(calls, 2, '503 is retried once before the miss is reported');
  assert.equal(result.status, 'miss');
  if (result.status !== 'miss') return;
  assert.equal(result.reason, 'http_error');
  assert.equal(result.detail, 'status_503');
});

test('lookupWaybackSnapshot turns a transport failure into a miss rather than a throw', async () => {
  const client = async (): Promise<SafeHttpResponse> => {
    throw new Error('URL rejected by safe-fetch DNS pinning: private_address');
  };
  const result = await lookupWaybackSnapshot(client, 'https://example.org/a', {
    retries: 0,
    sleep: async () => {},
  });
  assert.equal(result.status, 'miss');
  if (result.status !== 'miss') return;
  assert.equal(result.reason, 'transport_error');
  assert.match(result.detail ?? '', /private_address/);
});

test('lookupWaybackSnapshot rejects a non-JSON body instead of parsing it', async () => {
  const client = async (): Promise<SafeHttpResponse> => ({
    status: 200,
    headers: { 'content-type': 'text/html' },
    bodyText: '<html>rate limited</html>',
    finalUrl: '',
  });
  const result = await lookupWaybackSnapshot(client, 'https://example.org/a');
  assert.equal(result.status, 'miss');
  if (result.status !== 'miss') return;
  assert.equal(result.reason, 'malformed_response');
  assert.equal(result.detail, 'content_type_not_allowed');
});

test('parseWaybackAvailabilityResponse never invents a pointer', () => {
  // available:false, a missing timestamp, and a pointer that is not on an archive.org host must
  // all fail closed. The last one is the one that matters: it is how a surprising response would
  // otherwise smuggle an arbitrary URL into an evidence row.
  const notAvailable = parseWaybackAvailabilityResponse({
    archived_snapshots: {
      closest: { available: false, url: 'https://web.archive.org/web/1/x', timestamp: '1' },
    },
  });
  assert.equal(notAvailable.status, 'miss');

  const noTimestamp = parseWaybackAvailabilityResponse({
    archived_snapshots: { closest: { available: true, url: 'https://web.archive.org/web/1/x' } },
  });
  assert.equal(noTimestamp.status, 'miss');

  const offArchive = parseWaybackAvailabilityResponse({
    archived_snapshots: {
      closest: {
        available: true,
        url: 'https://evil.example.com/web/1/x',
        timestamp: '20260101000000',
      },
    },
  });
  assert.equal(offArchive.status, 'miss');
  if (offArchive.status !== 'miss') return;
  assert.equal(offArchive.reason, 'malformed_response');
  assert.equal(offArchive.detail, 'closest_url_not_an_archive_pointer');

  assert.equal(parseWaybackAvailabilityResponse(null).status, 'miss');
  assert.equal(parseWaybackAvailabilityResponse({}).status, 'miss');
});

test('archive pointers reject landing pages, invalid dates, wrong sources, and non-success snapshots', () => {
  const target = 'https://example.org/source';
  for (const url of [
    'https://archive.org/',
    'https://web.archive.org/save/https://example.org/source',
    'https://web.archive.org/web/20260230000000/https://example.org/source',
    'https://web.archive.org/web/20260101000000/https://example.org/other',
  ]) {
    assert.equal(parseWaybackCaptureUrl(url, target), null);
  }
  assert.equal(
    parseWaybackAvailabilityResponse(
      {
        archived_snapshots: {
          closest: {
            available: true,
            timestamp: '20260101000000',
            status: '404',
            url: 'https://web.archive.org/web/20260101000000/https://example.org/source',
          },
        },
      },
      target,
    ).status,
    'miss',
  );
});
