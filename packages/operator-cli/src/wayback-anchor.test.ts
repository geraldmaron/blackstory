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
import {
  attachWaybackMetadata,
  createWaybackAnchor,
  type WaybackJob,
  type WaybackJobStore,
} from './wayback-anchor.js';

const CREDENTIALS = { accessKey: 'test-access', secretKey: 'test-secret' };
const NOW = '2026-09-01T15:00:00.000Z';

function memoryJobs(): WaybackJobStore {
  const jobs = new Map<string, WaybackJob>();
  return {
    async reserve(url) {
      const existing = jobs.get(url);
      if (existing) return { ...existing, created: false };
      const job: WaybackJob = { created: true, state: 'reserved', jobId: null, result: null };
      jobs.set(url, job);
      return job;
    },
    async submitted(url, jobId) {
      jobs.set(url, { created: false, state: 'pending', jobId, result: null });
    },
    async finish(url, result) {
      const previous = jobs.get(url)!;
      jobs.set(url, {
        ...previous,
        state:
          result.status === 'anchored'
            ? 'anchored'
            : result.status === 'pending'
              ? 'pending'
              : 'failed',
        result,
      });
    },
  };
}
const decisionForUrl = (sourceUrl: string) => ({
  sourceUrl,
  allowTextRetention: true,
  allowArchive: true,
  sensitivity: 'public' as const,
  reviewedBy: 'fixture-reviewer',
  reviewedAt: '2026-01-01T00:00:00Z',
  expiresAt: '2027-01-01T00:00:00Z',
  basis: 'Synthetic test authorization',
});

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
    jobs: memoryJobs(),
    decisionForUrl,
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
    jobs: memoryJobs(),
    decisionForUrl,
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

test('pending archive jobs resume without another POST and unknown permissions never submit', async () => {
  let posts = 0;
  let polls = 0;
  const client: SafeHttpClient = async (request) => {
    if (request.method === 'POST') {
      posts += 1;
      return jsonResponse({ job_id: 'resume-1' });
    }
    return jsonResponse(
      ++polls === 1
        ? { status: 'pending' }
        : {
            status: 'success',
            timestamp: '20260901150000',
            original_url: 'https://example.gov/record',
          },
    );
  };
  const anchor = createWaybackAnchor({
    client,
    credentials: CREDENTIALS,
    now: () => NOW,
    decisionForUrl,
    jobs: memoryJobs(),
    maxAttempts: 1,
  });
  assert.equal((await anchor.captureUrl('https://example.gov/record')).status, 'pending');
  assert.equal((await anchor.captureUrl('https://example.gov/record')).status, 'anchored');
  assert.equal(posts, 1);
  const denied = createWaybackAnchor({
    client,
    credentials: CREDENTIALS,
    now: () => NOW,
    decisionForUrl: () => undefined,
    jobs: memoryJobs(),
  });
  assert.equal((await denied.captureUrl('https://example.gov/private')).status, 'failed');
  assert.equal(posts, 1);
});
test('an ambiguous submission is retained and never retried automatically', async () => {
  let calls = 0;
  const anchor = createWaybackAnchor({
    client: async () => {
      calls += 1;
      throw new Error('connection lost');
    },
    credentials: CREDENTIALS,
    now: () => NOW,
    decisionForUrl,
    jobs: memoryJobs(),
  });
  assert.equal((await anchor.captureUrl('https://example.gov/record')).status, 'failed');
  assert.deepEqual(await anchor.captureUrl('https://example.gov/record'), {
    status: 'failed',
    reason: 'submission_outcome_unknown_requires_reconciliation',
  });
  assert.equal(calls, 1);
});
