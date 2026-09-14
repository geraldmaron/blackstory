/**
 * Wayback availability lookup tests. HTTP is a mock SafeHttpClient; no live archive.org calls.
 * The point being pinned is that a lookup is a fallback, so it reports rather than throws, and
 * that its jsonb keys stay distinguishable from the SPN anchor's on a row that saw both.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  WAYBACK_AVAILABILITY_URL,
  type SafeHttpClient,
  type SafeHttpRequest,
  type SafeHttpResponse,
} from '@repo/domain';
import { attachWaybackMetadata } from './wayback-anchor.js';
import { attachWaybackLookup, createWaybackLookup } from './wayback-lookup.js';

function jsonResponse(body: unknown, status = 200): SafeHttpResponse {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    bodyText: JSON.stringify(body),
    finalUrl: '',
  };
}

const HIT = {
  archived_snapshots: {
    closest: {
      status: '200',
      available: true,
      url: 'http://web.archive.org/web/20260214093311/https://gazette.example.org/1948/inquest',
      timestamp: '20260214093311',
    },
  },
};

test('createWaybackLookup queries the availability API and returns the snapshot', async () => {
  const requests: SafeHttpRequest[] = [];
  const client: SafeHttpClient = async (request) => {
    requests.push(request);
    return jsonResponse(HIT);
  };
  const lookup = createWaybackLookup({ client });
  const result = await lookup.findSnapshot('https://gazette.example.org/1948/inquest');

  assert.equal(requests.length, 1);
  assert.ok(requests[0]?.url.startsWith(WAYBACK_AVAILABILITY_URL));
  assert.equal(requests[0]?.method, 'GET');
  assert.equal(result.status, 'found');
  if (result.status !== 'found') return;
  assert.equal(
    result.snapshot.url,
    'https://web.archive.org/web/20260214093311/https://gazette.example.org/1948/inquest',
  );
});

test('createWaybackLookup reports a thrown transport error as a miss', async () => {
  const client: SafeHttpClient = async () => {
    throw new Error('request_timeout');
  };
  const lookup = createWaybackLookup({ client, retries: 0, sleep: async () => {} });
  const result = await lookup.findSnapshot('https://gazette.example.org/1948/inquest');
  assert.equal(result.status, 'miss');
  if (result.status !== 'miss') return;
  assert.equal(result.reason, 'transport_error');
});

test('attachWaybackLookup records a found snapshot with its provenance', () => {
  const merged = attachWaybackLookup(
    { stored: 'metadata-only', sha256: 'abc' },
    {
      status: 'found',
      snapshot: {
        url: 'https://web.archive.org/web/20260214093311/https://gazette.example.org/1948/inquest',
        timestamp: '20260214093311',
        httpStatus: '200',
      },
    },
  );
  assert.equal(merged.stored, 'metadata-only', 'existing keys survive the merge');
  assert.equal(merged.waybackLookupStatus, 'found');
  assert.equal(
    merged.waybackCaptureUrl,
    'https://web.archive.org/web/20260214093311/https://gazette.example.org/1948/inquest',
  );
  assert.equal(merged.waybackCaptureTimestamp, '20260214093311');
  assert.equal(merged.waybackCaptureHttpStatus, '200');
  assert.equal(merged.waybackCaptureSource, 'availability-lookup');
});

test('attachWaybackLookup records a miss with its reason and never a URL', () => {
  const merged = attachWaybackLookup(
    { url: 'https://gazette.example.org/1948/inquest' },
    { status: 'miss', reason: 'no_snapshot' },
  );
  assert.equal(merged.waybackLookupStatus, 'miss');
  assert.equal(merged.waybackLookupReason, 'no_snapshot');
  assert.equal(
    merged.waybackCaptureUrl,
    undefined,
    'a miss must not leave a pointer key behind for a reader to mistake for a capture',
  );
});

test('a miss followed by an SPN anchor leaves both outcomes legible on one row', () => {
  // This is the ordering capture-backfill actually runs: look first, mint only if nothing
  // was found. The row has to say both things without either key overwriting the other.
  const afterLookup = attachWaybackLookup(
    { sha256: 'abc' },
    { status: 'miss', reason: 'no_snapshot' },
  );
  const afterAnchor = attachWaybackMetadata(afterLookup, {
    status: 'anchored',
    waybackCaptureUrl: 'https://web.archive.org/web/20260901150000/https://gazette.example.org/x',
    waybackCapturedAt: '2026-09-01T15:00:00.000Z',
  });
  assert.equal(afterAnchor.waybackLookupStatus, 'miss');
  assert.equal(afterAnchor.waybackLookupReason, 'no_snapshot');
  assert.equal(afterAnchor.waybackStatus, 'anchored');
  assert.equal(
    afterAnchor.waybackCaptureUrl,
    'https://web.archive.org/web/20260901150000/https://gazette.example.org/x',
  );
});
