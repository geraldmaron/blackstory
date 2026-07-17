/**
 * BB-083: link-health classification (alive/redirected/drifted/dead) and the
 * retry-before-declaring-dead state machine. The final test in this file proves the
 * `LinkCheckFetchResult` port is actually adaptable from BB-030's real `executeSafeFetch` —
 * `@black-book/security` is a devDependency of this package for exactly this kind of proof (see
 * packages/domain/src/map/map-source.redaction.test.ts for the established precedent).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SAFE_FETCH_LIMITS,
  executeSafeFetch,
  type PinnedTransportResponse,
} from '@black-book/security';
import {
  advanceLinkHealthState,
  classifyLinkCheckAttempt,
  contentHashFromHex,
  initialLinkHealthState,
  type LinkCheckFetchResult,
} from './link-health.js';

test('a 200 response with no redirects classifies as alive', () => {
  const result = classifyLinkCheckAttempt({
    fetch: { ok: true, finalUrl: 'https://example.gov/a', redirectCount: 0, contentHash: 'a'.repeat(64) },
  });
  assert.equal(result.status, 'alive');
});

test('a followed redirect classifies as redirected and records the final URL', () => {
  const result = classifyLinkCheckAttempt({
    fetch: {
      ok: true,
      finalUrl: 'https://example.gov/new-location',
      redirectCount: 1,
      contentHash: 'b'.repeat(64),
      permanentRedirect: true,
    },
  });
  assert.equal(result.status, 'redirected');
  assert.equal(result.redirectTarget, 'https://example.gov/new-location');
  assert.equal(result.permanentRedirect, true);
});

test('a 404 or 410 classifies as dead with the specific reason', () => {
  const notFound = classifyLinkCheckAttempt({
    fetch: { ok: false, reason: 'transport_failed', httpStatus: 404 },
  });
  assert.deepEqual([notFound.status, notFound.deadReason], ['dead', 'not_found']);

  const gone = classifyLinkCheckAttempt({
    fetch: { ok: false, reason: 'transport_failed', httpStatus: 410 },
  });
  assert.deepEqual([gone.status, gone.deadReason], ['dead', 'gone']);
});

test('a DNS resolution failure classifies as dead (NXDOMAIN-shaped)', () => {
  const result = classifyLinkCheckAttempt({
    fetch: { ok: false, reason: 'dns_resolution_failed' },
  });
  assert.deepEqual([result.status, result.deadReason], ['dead', 'dns_not_found']);
});

test('a 402/403 classifies as dead with paywalled reason', () => {
  const result = classifyLinkCheckAttempt({
    fetch: { ok: true, finalUrl: 'https://example.gov/a', redirectCount: 0, contentHash: 'c'.repeat(64), httpStatus: 402 },
  });
  assert.deepEqual([result.status, result.deadReason], ['dead', 'paywalled']);
});

test('an ambiguous transport failure classifies as pending_retry, not dead', () => {
  const result = classifyLinkCheckAttempt({ fetch: { ok: false, reason: 'transport_failed' } });
  assert.equal(result.status, 'pending_retry');
});

test('a content-hash mismatch with divergent text classifies as drifted', () => {
  const result = classifyLinkCheckAttempt({
    fetch: {
      ok: true,
      finalUrl: 'https://example.gov/a',
      redirectCount: 0,
      contentHash: 'd'.repeat(64),
    },
    capturedContentHash: contentHashFromHex('e'.repeat(64)),
    capturedText: 'The grand jury convened in Levy County to review the events of January 1923.',
    liveText: 'This domain is now for sale. Contact us for pricing on premium web real estate.',
  });
  assert.equal(result.status, 'drifted');
  assert.equal(result.drift?.diverged, true);
});

test('a content-hash mismatch with similar text does not flag drift', () => {
  const result = classifyLinkCheckAttempt({
    fetch: { ok: true, finalUrl: 'https://example.gov/a', redirectCount: 0, contentHash: 'f'.repeat(64) },
    capturedContentHash: contentHashFromHex('e'.repeat(64)),
    capturedText: 'The grand jury convened in Levy County to review the events of January 1923.',
    liveText: 'The grand jury convened in Levy County to review the events of January 1923!',
  });
  assert.equal(result.status, 'alive');
});

test('retry-before-death: consecutive pending_retry attempts do not flip to dead until the budget is exhausted', () => {
  let state = initialLinkHealthState('cit-1', '2026-01-01T00:00:00.000Z');
  const attempt = classifyLinkCheckAttempt({ fetch: { ok: false, reason: 'transport_failed' } });

  state = advanceLinkHealthState(state, attempt, { checkedAt: '2026-01-08T00:00:00.000Z', maxRetriesBeforeDead: 3 });
  assert.equal(state.status, 'alive', 'first failure must not declare death');
  assert.equal(state.consecutiveFailures, 1);

  state = advanceLinkHealthState(state, attempt, { checkedAt: '2026-01-15T00:00:00.000Z', maxRetriesBeforeDead: 3 });
  assert.equal(state.status, 'alive', 'second failure must still not declare death');
  assert.equal(state.consecutiveFailures, 2);

  state = advanceLinkHealthState(state, attempt, { checkedAt: '2026-01-22T00:00:00.000Z', maxRetriesBeforeDead: 3 });
  assert.equal(state.status, 'dead', 'third consecutive failure exhausts the retry budget');
  assert.equal(state.consecutiveFailures, 3);
});

test('retry-before-death: a success in between resets the consecutive-failure counter', () => {
  let state = initialLinkHealthState('cit-1', '2026-01-01T00:00:00.000Z');
  const failure = classifyLinkCheckAttempt({ fetch: { ok: false, reason: 'transport_failed' } });
  const success = classifyLinkCheckAttempt({
    fetch: { ok: true, finalUrl: 'https://example.gov/a', redirectCount: 0, contentHash: 'a'.repeat(64) },
  });

  state = advanceLinkHealthState(state, failure, { checkedAt: '2026-01-08T00:00:00.000Z' });
  assert.equal(state.consecutiveFailures, 1);
  state = advanceLinkHealthState(state, success, { checkedAt: '2026-01-15T00:00:00.000Z' });
  assert.equal(state.consecutiveFailures, 0);
  assert.equal(state.status, 'alive');
});

test('an explicit dead classification (e.g. 404) is not subject to the retry budget', () => {
  const state = initialLinkHealthState('cit-1', '2026-01-01T00:00:00.000Z');
  const notFound = classifyLinkCheckAttempt({ fetch: { ok: false, reason: 'transport_failed', httpStatus: 404 } });
  const advanced = advanceLinkHealthState(state, notFound, { checkedAt: '2026-01-08T00:00:00.000Z', maxRetriesBeforeDead: 3 });
  assert.equal(advanced.status, 'dead');
});

/**
 * Proves the `LinkCheckFetchResult` port genuinely adapts from BB-030's real
 * `executeSafeFetch` — not just a structurally-similar type asserted in a comment. Builds a
 * minimal fake DNS resolver + pinned transport (the same dependency-injection shape BB-030's
 * own tests use) and confirms the adapted result classifies as expected.
 */
test('the link-health port adapts a real executeSafeFetch(...) result from @black-book/security', async () => {
  const html = Buffer.from('<html><body>Hello, archive.</body></html>', 'utf8');
  const transport = async (): Promise<PinnedTransportResponse> => ({
    status: 200,
    headers: { 'content-type': 'text/html', 'content-length': String(html.byteLength) },
    remoteAddress: '93.184.216.34',
    body: (async function* () {
      yield new Uint8Array(html);
    })(),
  });

  const safeFetchResult = await executeSafeFetch(
    'https://example.gov/a',
    {
      resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
      transport,
    },
    { limits: DEFAULT_SAFE_FETCH_LIMITS },
  );

  assert.equal(safeFetchResult.ok, true);
  if (!safeFetchResult.ok) return;

  // Adapt the real BB-030 result into the link-health port — this is exactly what the
  // scheduled job wrapper does (packages/config/src/scheduled-jobs/jobs/
  // citation-link-health-sweep.ts).
  const port: LinkCheckFetchResult = {
    ok: true,
    finalUrl: safeFetchResult.finalUrl,
    redirectCount: safeFetchResult.redirectCount,
    contentHash: safeFetchResult.contentHash,
  };
  const classification = classifyLinkCheckAttempt({ fetch: port });
  assert.equal(classification.status, 'alive');
});
