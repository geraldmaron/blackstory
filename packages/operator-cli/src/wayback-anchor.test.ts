/**
 * Wayback SPN2 anchor tests. HTTP is a mock SafeHttpClient; no live archive.org calls.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  WAYBACK_SPN_SUBMIT_URL,
  type SafeHttpClient,
  type SafeHttpRequest,
  type SafeHttpResponse,
} from '@repo/domain';
import { attachWaybackMetadata, createWaybackAnchor } from './wayback-anchor.js';

const CREDENTIALS = { accessKey: 'test-access', secretKey: 'test-secret' };
const NOW = '2026-09-01T15:00:00.000Z';

function jsonResponse(body: unknown, status = 200): SafeHttpResponse {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    bodyText: JSON.stringify(body),
    finalUrl: '',
  };
}

test('createWaybackAnchor returns a capture URL after submit + successful poll', async () => {
  const requests: SafeHttpRequest[] = [];
  const client: SafeHttpClient = async (request) => {
    requests.push(request);
    if (request.url === WAYBACK_SPN_SUBMIT_URL) {
      return jsonResponse({ job_id: 'spn2-job-1' });
    }
    return jsonResponse({
      status: 'success',
      timestamp: '20260901150000',
      original_url: 'https://example.gov/record',
    });
  };
  const anchor = createWaybackAnchor({
    client,
    credentials: CREDENTIALS,
    now: () => NOW,
    sleep: async () => undefined,
    maxAttempts: 1,
    delayMs: 0,
  });
  const attempt = await anchor.captureUrl('https://example.gov/record');
  assert.equal(attempt.status, 'anchored');
  if (attempt.status !== 'anchored') return;
  assert.equal(
    attempt.waybackCaptureUrl,
    'https://web.archive.org/web/20260901150000/https://example.gov/record',
  );
  assert.equal(attempt.waybackCapturedAt, NOW);
  assert.equal(requests[0]?.method, 'POST');
  assert.equal(requests[0]?.headers?.authorization, 'LOW test-access:test-secret');
});

test('createWaybackAnchor skips (does not throw) when SPN submit fails', async () => {
  const client: SafeHttpClient = async () => jsonResponse({ error: 'unavailable' }, 400);
  const anchor = createWaybackAnchor({
    client,
    credentials: CREDENTIALS,
    now: () => NOW,
    sleep: async () => undefined,
  });
  const attempt = await anchor.captureUrl('https://example.gov/record');
  assert.equal(attempt.status, 'failed');
  if (attempt.status !== 'failed') return;
  assert.match(attempt.reason, /400/);
});

test('attachWaybackMetadata stores snapshot URL on success and reason on failure', () => {
  const base = { stored: 'metadata-only', sha256: 'abc' };
  assert.deepEqual(
    attachWaybackMetadata(base, {
      status: 'anchored',
      waybackCaptureUrl: 'https://web.archive.org/web/1/https://x',
      waybackCapturedAt: NOW,
    }),
    {
      stored: 'metadata-only',
      sha256: 'abc',
      waybackStatus: 'anchored',
      waybackCaptureUrl: 'https://web.archive.org/web/1/https://x',
      waybackCapturedAt: NOW,
    },
  );
  assert.deepEqual(attachWaybackMetadata(base, { status: 'failed', reason: 'timed_out' }), {
    stored: 'metadata-only',
    sha256: 'abc',
    waybackStatus: 'failed',
    waybackReason: 'timed_out',
  });
});
