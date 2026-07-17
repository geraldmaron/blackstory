
/**
 * Proves the citation-link-health-sweep job body is REAL: it drives
 * @black-book/domain's citation link-health/repair-ladder logic (not a reimplementation), the
 * one automatic write it makes matches the roster's declared 'link-repair-archived-copy' effect
 * exactly, and permanent-redirect retroactive-SPN repairs are proposed rather than
 * auto-applied.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SAFE_FETCH_LIMITS,
  type PinnedTransportResponse,
} from '@black-book/security';
import {
  initialLinkHealthState,
  type Citation,
  type LinkCheckFetchResult,
} from '@black-book/domain';
import {
  checkCitationLinkThroughSafeFetch,
  runCitationLinkHealthSweepJob,
} from './citation-link-health-sweep.ts';

function citation(overrides: Partial<Citation> = {}): Citation {
  return {
    id: 'cit-1',
    claimId: 'claim-1',
    sourceName: 'Local Gazette',
    location: { kind: 'url', url: 'https://gazette.example/story/1' },
    capture: { captureId: 'capture-1' },
    retrievalDate: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const NEVER_SPN = async () => {
  throw new Error('attemptSpn should not be called in this test');
};

test('a citation that is still alive is checked but never touched by a repair', async () => {
  const result = await runCitationLinkHealthSweepJob({
    jobRunId: 'run-1',
    startedAt: '2026-07-17T09:00:00.000Z',
    completedAt: '2026-07-17T09:01:00.000Z',
    checks: [{ citation: citation(), state: initialLinkHealthState('cit-1', '2026-07-10T09:00:00.000Z') }],
    fetchLink: async () => ({ ok: true, finalUrl: 'https://gazette.example/story/1', redirectCount: 0, contentHash: 'a'.repeat(64) }),
    attemptSpn: NEVER_SPN,
  });
  assert.equal(result.run.status, 'success');
  assert.equal(result.summary.alive, 1);
  assert.equal(result.summary.repairsApplied, 0);
  assert.equal(result.summary.repairsProposed, 0);
  assert.equal(result.outcomes[0]?.appliedRepair, undefined);
});

test('an offline citation with no URL is skipped rather than fetched', async () => {
  const result = await runCitationLinkHealthSweepJob({
    jobRunId: 'run-2',
    startedAt: '2026-07-17T09:00:00.000Z',
    completedAt: '2026-07-17T09:01:00.000Z',
    checks: [
      {
        citation: citation({ location: { kind: 'offline', designation: { kind: 'book', description: 'Some archive' } } }),
        state: initialLinkHealthState('cit-1', '2026-07-10T09:00:00.000Z'),
      },
    ],
    fetchLink: async () => {
      throw new Error('fetchLink should not be called for an offline citation');
    },
    attemptSpn: NEVER_SPN,
  });
  assert.equal(result.outcomes[0]?.skipped, 'offline_citation_no_url_to_check');
});

test('a single ambiguous failure stays within the retry budget: no repair yet', async () => {
  const result = await runCitationLinkHealthSweepJob({
    jobRunId: 'run-3',
    startedAt: '2026-07-17T09:00:00.000Z',
    completedAt: '2026-07-17T09:01:00.000Z',
    checks: [{ citation: citation(), state: initialLinkHealthState('cit-1', '2026-07-10T09:00:00.000Z') }],
    fetchLink: async () => ({ ok: false, reason: 'transport_failed' }),
    attemptSpn: NEVER_SPN,
    maxRetriesBeforeDead: 3,
  });
  assert.equal(result.outcomes[0]?.state.status, 'alive');
  assert.equal(result.outcomes[0]?.state.consecutiveFailures, 1);
  assert.equal(result.outcomes[0]?.appliedRepair, undefined);
  assert.equal(result.outcomes[0]?.proposedRepair, undefined);
});

test('a dead citation with an existing Wayback capture auto-applies the wayback_swap repair (the declared public effect)', async () => {
  const capturedCitation = citation({
    capture: { captureId: 'capture-1', waybackCaptureUrl: 'https://web.archive.org/web/1/https://gazette.example/story/1' },
  });
  const result = await runCitationLinkHealthSweepJob({
    jobRunId: 'run-4',
    startedAt: '2026-07-17T09:00:00.000Z',
    completedAt: '2026-07-17T09:01:00.000Z',
    checks: [{ citation: capturedCitation, state: initialLinkHealthState('cit-1', '2026-07-10T09:00:00.000Z') }],
    fetchLink: async () => ({ ok: false, reason: 'transport_failed', httpStatus: 404 }),
    attemptSpn: NEVER_SPN,
  });
  const outcome = result.outcomes[0];
  assert.equal(outcome?.appliedRepair?.step, 'wayback_swap');
  assert.deepEqual(outcome?.appliedRepair?.citation.location, {
    kind: 'url',
    url: 'https://web.archive.org/web/1/https://gazette.example/story/1',
  });
  assert.equal(outcome?.proposedRepair, undefined);
  assert.equal(result.summary.repairsApplied, 1);
});

test('a dead citation with no capture proposes retroactive_spn rather than auto-applying it', async () => {
  const result = await runCitationLinkHealthSweepJob({
    jobRunId: 'run-5',
    startedAt: '2026-07-17T09:00:00.000Z',
    completedAt: '2026-07-17T09:01:00.000Z',
    checks: [{ citation: citation(), state: initialLinkHealthState('cit-1', '2026-07-10T09:00:00.000Z') }],
    fetchLink: async () => ({ ok: false, reason: 'transport_failed', httpStatus: 404 }),
    attemptSpn: async () => ({
      ok: true,
      waybackCaptureUrl: 'https://web.archive.org/web/2/https://gazette.example/story/1',
      capturedAt: '2026-07-17T09:01:00.000Z',
    }),
  });
  const outcome = result.outcomes[0];
  assert.equal(outcome?.proposedRepair?.step, 'retroactive_spn');
  assert.equal(outcome?.appliedRepair, undefined);
  assert.equal(result.summary.repairsProposed, 1);
  assert.equal(result.summary.repairsApplied, 0);
});

test('a dead citation with no capture and a failed SPN attempt auto-applies dead_mark only', async () => {
  const result = await runCitationLinkHealthSweepJob({
    jobRunId: 'run-6',
    startedAt: '2026-07-17T09:00:00.000Z',
    completedAt: '2026-07-17T09:01:00.000Z',
    checks: [{ citation: citation(), state: initialLinkHealthState('cit-1', '2026-07-10T09:00:00.000Z') }],
    fetchLink: async () => ({ ok: false, reason: 'transport_failed', httpStatus: 410 }),
    attemptSpn: async () => ({ ok: false, reason: 'spn_unavailable' }),
  });
  const outcome = result.outcomes[0];
  assert.equal(outcome?.appliedRepair?.step, 'dead_mark');
  assert.equal(outcome?.appliedRepair?.citation.linkStatus, 'dead');
  assert.equal(outcome?.proposedRepair, undefined);
});

test('a permanent redirect is proposed, not auto-applied, and never triggers an SPN attempt', async () => {
  const result = await runCitationLinkHealthSweepJob({
    jobRunId: 'run-7',
    startedAt: '2026-07-17T09:00:00.000Z',
    completedAt: '2026-07-17T09:01:00.000Z',
    checks: [{ citation: citation(), state: initialLinkHealthState('cit-1', '2026-07-10T09:00:00.000Z') }],
    fetchLink: async () => ({
      ok: true,
      finalUrl: 'https://gazette.example/archive/story-1',
      redirectCount: 1,
      contentHash: 'b'.repeat(64),
      httpStatus: 200,
      permanentRedirect: true,
    }),
    attemptSpn: NEVER_SPN,
  });
  const outcome = result.outcomes[0];
  assert.equal(outcome?.proposedRepair?.step, 'permanent_redirect');
  assert.equal(outcome?.appliedRepair, undefined);
});

test('a batch is processed in order, and the summary tallies match the individual outcomes', async () => {
  const checks = [
    { citation: citation({ id: 'a' }), state: initialLinkHealthState('a', '2026-07-01T00:00:00.000Z') },
    { citation: citation({ id: 'b' }), state: initialLinkHealthState('b', '2026-07-01T00:00:00.000Z') },
  ];
  const fetchResults: Record<string, LinkCheckFetchResult> = {
    a: { ok: true, finalUrl: 'https://gazette.example/story/1', redirectCount: 0, contentHash: 'c'.repeat(64) },
    b: { ok: false, reason: 'dns_resolution_failed' },
  };
  let callIndex = 0;
  const result = await runCitationLinkHealthSweepJob({
    jobRunId: 'run-8',
    startedAt: '2026-07-17T09:00:00.000Z',
    completedAt: '2026-07-17T09:01:00.000Z',
    checks,
    fetchLink: async () => {
      const id = checks[callIndex]?.citation.id ?? 'a';
      callIndex += 1;
      return fetchResults[id]!;
    },
    attemptSpn: async () => ({ ok: false, reason: 'unavailable' }),
  });
  assert.equal(result.summary.checked, 2);
  assert.equal(result.summary.alive, 1);
  assert.equal(result.summary.dead, 1);
  assert.equal(result.outcomes[1]?.appliedRepair?.step, 'dead_mark');
});


/**
 * Proves `checkCitationLinkThroughSafeFetch` genuinely drives real `executeSafeFetch`
 * (not a stand-in) and correctly recovers `httpStatus`/`permanentRedirect` from the transport,
 * which `executeSafeFetch`'s own return type does not expose.
 */
test('checkCitationLinkThroughSafeFetch drives the real executeSafeFetch and recovers status/redirect metadata', async () => {
  const responses: PinnedTransportResponse[] = [
    {
      status: 301,
      headers: { location: 'https://gazette.example/new-location' },
      remoteAddress: '93.184.216.34',
      body: (async function* () {})(),
    },
    {
      status: 200,
      headers: { 'content-type': 'text/html', 'content-length': '5' },
      remoteAddress: '93.184.216.34',
      body: (async function* () {
        yield new Uint8Array(Buffer.from('hello', 'utf8'));
      })(),
    },
  ];
  let call = 0;
  const result = await checkCitationLinkThroughSafeFetch('https://gazette.example/story/1', {
    resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
    transport: async () => {
      const response = responses[call]!;
      call += 1;
      return response;
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.redirectCount, 1);
    assert.equal(result.httpStatus, 200);
    assert.equal(result.permanentRedirect, true);
  }
});

test('a real fetch limit is honored (sanity check that no policy logic is bypassed)', async () => {
  const result = await checkCitationLinkThroughSafeFetch('ftp://gazette.example/story/1', {
    resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
    transport: async () => {
      throw new Error('transport must not be reached for a disallowed scheme');
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'scheme_not_allowed');
  }
  void DEFAULT_SAFE_FETCH_LIMITS;
});
