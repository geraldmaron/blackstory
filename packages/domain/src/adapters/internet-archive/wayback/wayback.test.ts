/**
 * Tests for the Wayback SPN2 capture layer (BB-073). Fixture-driven; every HTTP call goes
 * through a mock SafeHttpClient injected by the test, never a real fetch. Proves the ordering
 * invariant from acceptance criterion 2: a candidate can only become "review eligible" after a
 * successful capture is awaited and validated.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { SafeHttpRequest, SafeHttpResponse } from '../shared/http-port.js';
import { normalizeFeedXml, type FeedRegistryEntry } from '../../rss/index.js';
import type { SourceRegistryEntry } from '../../types.js';
import type { EvidenceSource } from '../../../provenance/source.js';
import {
  assertReviewEligible,
  buildWaybackCaptureUrl,
  captureUrlToEvidencePointer,
  parseSpnStatusResponse,
  pollSpnStatus,
  requireCaptureBeforeReview,
  requireCaptureForAllCandidates,
  submitSpnCapture,
  waybackSpnStatusUrl,
  WAYBACK_SPN_SUBMIT_URL,
  type SpnCredentials,
} from './index.js';

const FIXED_NOW = '2026-07-17T20:00:00.000Z';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const CREDENTIALS: SpnCredentials = { accessKey: 'test-access-key', secretKey: 'test-secret-key' };

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as T;
}

function jsonResponse(body: unknown, status = 200): SafeHttpResponse {
  return { status, headers: { 'content-type': 'application/json' }, bodyText: JSON.stringify(body), finalUrl: '' };
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
  const client = async (): Promise<SafeHttpResponse> => jsonResponse(loadFixture('spn-submit-response.json'));
  await assert.rejects(
    () => submitSpnCapture(client, { accessKey: '', secretKey: '' }, 'https://example.org/x'),
    /credentials/,
  );
});

test('parseSpnStatusResponse is defensive against malformed payloads', () => {
  assert.equal(parseSpnStatusResponse(null).status, 'error');
  assert.equal(parseSpnStatusResponse({ status: 'not-a-real-status' }).status, 'error');
  assert.equal(parseSpnStatusResponse(loadFixture('spn-status-success.json')).status, 'success');
  assert.equal(parseSpnStatusResponse(loadFixture('spn-status-success.json')).timestamp, '20260717140512');
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

test('pollSpnStatus times out (fails closed) rather than waiting forever', async () => {
  const client = async (): Promise<SafeHttpResponse> => jsonResponse(loadFixture('spn-status-pending.json'));
  const result = await pollSpnStatus(client, 'spn2-job-stuck', {
    maxAttempts: 3,
    delayMs: 10,
    sleep: async () => {},
  });
  assert.equal(result.status, 'error');
  assert.equal(result.message, 'timed_out_waiting_for_capture');
});

test('buildWaybackCaptureUrl matches the archive.org web/<timestamp>/<url> pattern', () => {
  const url = buildWaybackCaptureUrl('20260717140512', 'https://example.org/article');
  assert.equal(url, 'https://web.archive.org/web/20260717140512/https://example.org/article');
});

test('captureUrlToEvidencePointer produces a BB-077-valid EvidencePointer end to end', async () => {
  const calls: string[] = [];
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    if (request.url === WAYBACK_SPN_SUBMIT_URL) {
      calls.push('submit');
      return jsonResponse(loadFixture('spn-submit-response.json'));
    }
    calls.push('status');
    return jsonResponse(loadFixture('spn-status-success.json'));
  };

  const pointer = await captureUrlToEvidencePointer({
    client,
    credentials: CREDENTIALS,
    targetUrl: 'https://www.piedmonthistoricalsociety.example.org/news/freedmens-bureau-correspondence',
    snippet: 'The Society digitized 214 Freedmen’s Bureau letters from 1866-1870.',
    adapterId: 'rss',
    now: FIXED_NOW,
  });

  assert.deepEqual(calls, ['submit', 'status']);
  assert.equal(
    pointer.waybackCaptureUrl,
    'https://web.archive.org/web/20260717140512/https://www.piedmonthistoricalsociety.example.org/news/freedmens-bureau-correspondence',
  );
  assert.equal(pointer.sourceUrl, 'https://www.piedmonthistoricalsociety.example.org/news/freedmens-bureau-correspondence');
  assert.equal(pointer.waybackCapturedAt, '2026-07-17T14:05:12.000Z');
});

test('captureUrlToEvidencePointer fails closed when SPN reports an error', async () => {
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    if (request.url === WAYBACK_SPN_SUBMIT_URL) {
      return jsonResponse({ url: 'https://example.org/missing', job_id: 'spn2-job-def456' });
    }
    return jsonResponse(loadFixture('spn-status-error.json'));
  };
  await assert.rejects(
    () =>
      captureUrlToEvidencePointer({
        client,
        credentials: CREDENTIALS,
        targetUrl: 'https://example.org/missing',
        snippet: 'short snippet',
        adapterId: 'rss',
        now: FIXED_NOW,
      }),
    /did not succeed/,
  );
});

test('ORDERING INVARIANT: assertReviewEligible throws when no capture pointer is present', () => {
  assert.throws(() => assertReviewEligible({}), /missing the mandatory Wayback capture pointer/);
});

test('ORDERING INVARIANT: requireCaptureBeforeReview only marks a candidate eligible AFTER the capture resolves', async () => {
  const order: string[] = [];
  const candidate = { id: 'disc_1', canonicalUrl: 'https://example.org/article' };

  const capture = async (url: string) => {
    order.push(`capture_started:${url}`);
    const pointer = await captureUrlToEvidencePointer({
      client: async (request: SafeHttpRequest) => {
        if (request.url === WAYBACK_SPN_SUBMIT_URL) {
          return jsonResponse(loadFixture('spn-submit-response.json'));
        }
        return jsonResponse(loadFixture('spn-status-success.json'));
      },
      credentials: CREDENTIALS,
      targetUrl: url,
      snippet: 'short snippet',
      adapterId: 'rss',
      now: FIXED_NOW,
    });
    order.push('capture_finished');
    return pointer;
  };

  const result = await requireCaptureBeforeReview(candidate, candidate.canonicalUrl, capture);
  order.push('marked_eligible');

  assert.deepEqual(order, ['capture_started:https://example.org/article', 'capture_finished', 'marked_eligible']);
  assert.equal(result.reviewEligible, true);
  assertReviewEligible(result);
});

test('ORDERING INVARIANT: a failed capture never produces a review-eligible candidate', async () => {
  const candidate = { id: 'disc_2', canonicalUrl: 'https://example.org/missing' };
  const failingCapture = async (): Promise<never> => {
    throw new Error('capture failed');
  };
  await assert.rejects(() => requireCaptureBeforeReview(candidate, candidate.canonicalUrl, failingCapture), /capture failed/);
});

test('requireCaptureBeforeReview rejects a candidate with no canonical URL to capture', async () => {
  await assert.rejects(
    () => requireCaptureBeforeReview({ id: 'x' }, '', async () => {
      throw new Error('should not be called');
    }),
    /no canonical URL/,
  );
});

test('END TO END: every real RSS-normalized candidate gets a capture pointer before it is review-eligible', async () => {
  const feed: FeedRegistryEntry = {
    id: 'feed_piedmont',
    feedUrl: 'https://www.piedmonthistoricalsociety.example.org/feed.xml',
    displayName: 'Piedmont Historical Society',
    classification: 'community_oral',
    institutionType: 'historical_society',
    status: 'active',
    revision: 1,
    addedAt: FIXED_NOW,
    addedBy: 'admin@blackbook.local',
  };
  const evidenceSource: EvidenceSource = {
    id: 'src_rss',
    displayName: 'RSS',
    classification: 'community_oral',
    adapterId: 'rss',
    stableIdScheme: 'rss-item',
    policy: { snapshotMode: 'selective', rights: { defaultStatus: 'licensed', publicationPermissions: ['cite'], prohibitedUses: [] } },
    adapterEnabled: true,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  const registryEntry: SourceRegistryEntry = {
    id: 'reg_rss',
    contract: {
      adapterId: 'rss',
      parserVersion: 'rss-parser-1.0.0',
      displayName: 'RSS',
      classification: 'community_oral',
      stableIdScheme: 'rss-item',
      policy: evidenceSource.policy,
      rights: evidenceSource.policy.rights,
      permittedClaimClasses: ['biographical_fact'],
      rateLimits: { requestsPerMinute: 30 },
      volume: { expectedRecordsPerRun: 50, countToleranceFraction: 0.4 },
      geographicCoverage: { countries: ['US'] },
      expectedSchemaVersion: 'candidate-record.v1',
    },
    evidenceSource,
    registryState: 'approved',
    approvedAt: FIXED_NOW,
    approvedBy: 'admin@blackbook.local',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
  const rssFixturePath = join(FIXTURES_DIR, '..', '..', '..', 'rss', 'fixtures', 'historical-society-feed.rss.xml');
  const xml = readFileSync(rssFixturePath, 'utf8');
  const candidates = normalizeFeedXml({ feed, xml, registryEntry, runId: 'run_e2e', capturedAt: FIXED_NOW });
  assert.equal(candidates.length, 2);

  let submitCount = 0;
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    if (request.url === WAYBACK_SPN_SUBMIT_URL) {
      submitCount += 1;
      return jsonResponse({ url: request.body, job_id: `job-${submitCount}` });
    }
    return jsonResponse({ status: 'success', timestamp: '20260717140512', original_url: 'x' });
  };

  const eligible = await requireCaptureForAllCandidates(candidates, {
    client,
    credentials: CREDENTIALS,
    snippetFor: (candidate) => candidate.payload.summary ?? candidate.title ?? 'no summary',
    adapterId: 'rss',
    now: FIXED_NOW,
  });

  assert.equal(eligible.length, 2);
  assert.equal(submitCount, 2);
  for (const item of eligible) {
    assertReviewEligible(item);
    assert.ok(item.capturePointer.waybackCaptureUrl.startsWith('https://web.archive.org/web/'));
  }
});

test('requireCaptureForAllCandidates fails the whole batch closed if any single capture fails — no partial silent success', async () => {
  const candidateA = { id: 'a', canonicalUrl: 'https://example.org/a' };
  const candidateB = { id: 'b', canonicalUrl: 'https://example.org/b-will-fail' };
  let submitCalls = 0;
  const client = async (request: SafeHttpRequest): Promise<SafeHttpResponse> => {
    if (request.url === WAYBACK_SPN_SUBMIT_URL) {
      submitCalls += 1;
      const isFailing = request.body?.includes('b-will-fail');
      return jsonResponse({ url: request.body, job_id: isFailing ? 'job-fail' : 'job-ok' });
    }
    const isFailing = request.url.includes('job-fail');
    return jsonResponse(isFailing ? { status: 'error', message: 'blocked_by_robots' } : { status: 'success', timestamp: '20260717140512', original_url: 'x' });
  };

  await assert.rejects(
    () =>
      requireCaptureForAllCandidates([candidateA, candidateB], {
        client,
        credentials: CREDENTIALS,
        snippetFor: () => 'short snippet',
        adapterId: 'rss',
        now: FIXED_NOW,
      }),
    /did not succeed/,
  );
  assert.equal(submitCalls, 2, 'both candidates should have been attempted, not short-circuited');
});
