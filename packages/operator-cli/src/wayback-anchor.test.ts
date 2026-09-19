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
  createPostgresWaybackJobStore,
  type WaybackJob,
  type WaybackJobStore,
} from './wayback-anchor.js';

const CREDENTIALS = { accessKey: 'test-access', secretKey: 'test-secret' };
const NOW = '2026-09-01T15:00:00.000Z';

function memoryJobs(): WaybackJobStore {
  const jobs = new Map<string, WaybackJob>();
  const key = (url: string, contentHashDigest: string) => `${url}\u0000${contentHashDigest}`;
  return {
    async reserve(url, contentHashDigest) {
      const jobKey = key(url, contentHashDigest);
      const existing = jobs.get(jobKey);
      if (existing) return { ...existing, created: false };
      const job: WaybackJob = { created: true, state: 'reserved', jobId: null, result: null };
      jobs.set(jobKey, job);
      return job;
    },
    async submitted(url, contentHashDigest, jobId) {
      jobs.set(key(url, contentHashDigest), {
        created: false,
        state: 'pending',
        jobId,
        result: null,
      });
    },
    async finish(url, contentHashDigest, result) {
      const jobKey = key(url, contentHashDigest);
      const previous = jobs.get(jobKey)!;
      jobs.set(jobKey, {
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
  const attempt = await anchor.captureUrl('https://example.gov/record', 'a'.repeat(64));
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
  const attempt = await anchor.captureUrl('https://example.gov/record', 'b'.repeat(64));
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
  assert.equal(
    (await anchor.captureUrl('https://example.gov/record', 'c'.repeat(64))).status,
    'pending',
  );
  assert.equal(
    (await anchor.captureUrl('https://example.gov/record', 'c'.repeat(64))).status,
    'anchored',
  );
  assert.equal(posts, 1);
  const denied = createWaybackAnchor({
    client,
    credentials: CREDENTIALS,
    now: () => NOW,
    decisionForUrl: () => undefined,
    jobs: memoryJobs(),
  });
  assert.equal(
    (await denied.captureUrl('https://example.gov/private', 'd'.repeat(64))).status,
    'failed',
  );
  assert.equal(posts, 1);
});

test('a changed content revision creates a new durable SPN job for the same URL', async () => {
  let posts = 0;
  const client: SafeHttpClient = async (request) => {
    if (request.method === 'POST') {
      posts += 1;
      return jsonResponse({ job_id: `revision-${posts}` });
    }
    return jsonResponse({
      status: 'success',
      timestamp: `2026090115000${posts}`,
      original_url: 'https://example.gov/record',
    });
  };
  const anchor = createWaybackAnchor({
    client,
    credentials: CREDENTIALS,
    now: () => NOW,
    decisionForUrl,
    jobs: memoryJobs(),
    maxAttempts: 1,
  });
  assert.equal(
    (await anchor.captureUrl('https://example.gov/record', '1'.repeat(64))).status,
    'anchored',
  );
  assert.equal(
    (await anchor.captureUrl('https://example.gov/record', '2'.repeat(64))).status,
    'anchored',
  );
  assert.equal(posts, 2);
});

test('the Postgres job store keys every transition by URL and content revision', async () => {
  const calls: { sql: string; params?: readonly unknown[] }[] = [];
  const store = createPostgresWaybackJobStore({
    async query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]) {
      calls.push({ sql, params });
      if (sql.includes('INSERT INTO')) return { rows: [] as T[] };
      return { rows: [{ state: 'reserved', job_id: null, result: null }] as T[] };
    },
  });
  const url = 'https://example.gov/record';
  const revision = 'f'.repeat(64);
  await store.reserve(url, revision, decisionForUrl(url));
  await store.submitted(url, revision, 'job-1');
  await store.finish(url, revision, { status: 'pending', jobId: 'job-1' });
  assert.deepEqual(calls[0]?.params?.slice(0, 2), [url, revision]);
  assert.deepEqual(calls[1]?.params, [url, revision]);
  assert.deepEqual(calls[2]?.params?.slice(0, 2), [url, revision]);
  assert.match(calls[0]?.sql ?? '', /content_hash_digest/);
  assert.match(calls[1]?.sql ?? '', /content_hash_digest/);
  assert.match(calls[2]?.sql ?? '', /content_hash_digest/);
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
  assert.equal(
    (await anchor.captureUrl('https://example.gov/record', 'e'.repeat(64))).status,
    'failed',
  );
  assert.deepEqual(await anchor.captureUrl('https://example.gov/record', 'e'.repeat(64)), {
    status: 'failed',
    reason: 'submission_outcome_unknown_requires_reconciliation',
  });
  assert.equal(calls, 1);
});
