import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SafeFetchResult } from '@repo/security/url-safety';
import {
  buildCaptureInventory,
  captureCitedUrl,
  createMetadataOnlyStorage,
  normalizeCaptureUrl,
  type CaptureDeps,
  type CitedUrl,
} from './source-capture.js';

test('normalizeCaptureUrl lowercases host, drops fragment, trims trailing slash', () => {
  assert.equal(normalizeCaptureUrl('HTTPS://WWW.Census.gov/data/'), 'https://www.census.gov/data');
  assert.equal(normalizeCaptureUrl('https://x.org/a?b=1#frag'), 'https://x.org/a?b=1');
  assert.equal(normalizeCaptureUrl('ftp://x.org/a'), null);
  assert.equal(normalizeCaptureUrl('not a url'), null);
});

test('buildCaptureInventory dedupes by normalized URL and tallies per surface', () => {
  const refs: CitedUrl[] = [
    { url: 'https://census.gov/a/', surface: 'packet', refId: 'p1' },
    { url: 'https://census.gov/a', surface: 'article', refId: 'a1' }, // dup of p1 after normalize
    { url: 'https://bls.gov/b', surface: 'packet', refId: 'p2' },
    { url: 'mailto:x@y.com', surface: 'entity', refId: 'e1' }, // dropped
  ];
  const inv = buildCaptureInventory(refs);
  assert.equal(inv.urls.length, 2);
  assert.equal(inv.bySurface.packet.cited, 2);
  assert.equal(inv.bySurface.packet.unique, 2);
  assert.equal(inv.bySurface.article.cited, 1);
  assert.equal(inv.bySurface.article.unique, 0); // its only URL was a dup
  assert.equal(inv.bySurface.entity.cited, 0); // mailto dropped before tally
});

const deterministicDeps = (fetchUrl: CaptureDeps['fetchUrl']): CaptureDeps => ({
  fetchUrl,
  storage: createMetadataOnlyStorage(),
  parserVersion: 'capture-backfill-v1',
  newId: (prefix, seed) => `${prefix}_${seed.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`,
  now: () => '2026-07-26T00:00:00.000Z',
});

const okResult = (hash: string): SafeFetchResult => ({
  ok: true,
  finalUrl: 'https://census.gov/a',
  redirectCount: 0,
  contentType: 'text/html',
  byteLength: 1234,
  contentHash: hash,
  parser: { safe: true, indicators: [], extractedText: 'Median income table 1972 ...' },
  quarantineState: 'validated',
  publicationAllowed: false,
});

test('captureCitedUrl on success builds a capture row + success event', async () => {
  const hash = 'a'.repeat(64);
  const out = await captureCitedUrl(
    { url: 'https://census.gov/a', surface: 'packet', refId: 'obs1' },
    deterministicDeps(async () => okResult(hash)),
  );
  assert.equal(out.status, 'success');
  assert.ok(out.capture);
  assert.equal(out.capture?.contentHashDigest, hash);
  assert.equal(out.capture?.contentHashAlgorithm, 'sha256');
  assert.equal(out.capture?.sourceItemId, null);
  assert.equal(out.capture?.snapshotMode, 'selective');
  assert.equal((out.capture?.storageObject as { stored?: string }).stored, 'metadata-only');
  assert.equal(out.retrievalEvent.status, 'success');
  assert.equal(out.retrievalEvent.httpStatus, 200);
});

test('captureCitedUrl on fetch failure builds only a failure event', async () => {
  const out = await captureCitedUrl(
    { url: 'https://dead.example/x', surface: 'article', refId: 'ref3' },
    deterministicDeps(
      async () =>
        ({
          ok: false,
          reason: 'transport_failed',
          quarantineState: 'rejected',
          publicationAllowed: false,
        }) as SafeFetchResult,
    ),
  );
  assert.equal(out.status, 'failure');
  assert.equal(out.capture, null);
  assert.equal(out.retrievalEvent.status, 'failure');
  assert.equal(out.retrievalEvent.httpStatus, null);
  assert.equal((out.retrievalEvent.detail as { reason?: string }).reason, 'transport_failed');
});
