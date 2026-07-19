/**
 * Unit tests for live catalog memory cache and Next.js 2MB data-cache size gates.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createLiveCatalogMemoryCache,
  estimateJsonCacheBytes,
  fitsNextDataCache,
  isOversizedLiveCatalogSentinel,
  liveCatalogCacheKey,
  NEXT_DATA_CACHE_MAX_BYTES,
  NEXT_DATA_CACHE_SAFE_BYTES,
  nextDataCacheValueForCatalog,
  OVERSIZED_LIVE_CATALOG_SENTINEL,
} from './live-catalog-cache';

test('estimateJsonCacheBytes matches UTF-8 JSON length', () => {
  const value = { id: 'ent_1', summary: 'café' };
  assert.equal(estimateJsonCacheBytes(value), Buffer.byteLength(JSON.stringify(value), 'utf8'));
});

test('fitsNextDataCache rejects empty and over-safe sizes', () => {
  assert.equal(fitsNextDataCache(0), false);
  assert.equal(fitsNextDataCache(NEXT_DATA_CACHE_SAFE_BYTES), true);
  assert.equal(fitsNextDataCache(NEXT_DATA_CACHE_SAFE_BYTES + 1), false);
  assert.equal(fitsNextDataCache(NEXT_DATA_CACHE_MAX_BYTES), false);
});

test('nextDataCacheValueForCatalog returns sentinel for oversized payloads', () => {
  const small = [{ id: 'a', name: 'small' }];
  assert.deepEqual(nextDataCacheValueForCatalog(small), small);

  // Build a payload larger than the safe Next data-cache ceiling without allocating 2MB of
  // unique strings in a loop that is hard to reason about — one long string is enough.
  const oversized = {
    blob: 'x'.repeat(NEXT_DATA_CACHE_SAFE_BYTES),
  };
  assert.ok(estimateJsonCacheBytes(oversized) > NEXT_DATA_CACHE_SAFE_BYTES);
  const gated = nextDataCacheValueForCatalog(oversized);
  assert.equal(isOversizedLiveCatalogSentinel(gated), true);
  assert.deepEqual(gated, OVERSIZED_LIVE_CATALOG_SENTINEL);
  // Sentinel itself must remain tiny so Next can store it.
  assert.ok(estimateJsonCacheBytes(OVERSIZED_LIVE_CATALOG_SENTINEL) < 64);
});

test('isOversizedLiveCatalogSentinel survives JSON round-trip (Next cache shape)', () => {
  const roundTripped = JSON.parse(JSON.stringify(OVERSIZED_LIVE_CATALOG_SENTINEL));
  assert.equal(isOversizedLiveCatalogSentinel(roundTripped), true);
  assert.equal(isOversizedLiveCatalogSentinel([{ id: 'ent_1' }]), false);
  assert.equal(isOversizedLiveCatalogSentinel(undefined), false);
});

test('createLiveCatalogMemoryCache respects TTL and max entries', () => {
  let nowMs = 1_000;
  const cache = createLiveCatalogMemoryCache<string>({
    maxEntries: 2,
    defaultTtlMs: 100,
    now: () => nowMs,
  });

  cache.set('a', 'A');
  cache.set('b', 'B');
  assert.equal(cache.get('a'), 'A');
  assert.equal(cache.size(), 2);

  cache.set('c', 'C');
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('b'), 'B');
  assert.equal(cache.get('c'), 'C');

  nowMs += 150;
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('c'), undefined);
  assert.equal(cache.size(), 0);
});

test('liveCatalogCacheKey encodes kind and release identity', () => {
  assert.equal(
    liveCatalogCacheKey('entities', 'rel_1', '2026-01-01T00:00:00.000Z'),
    'entities:rel_1:2026-01-01T00:00:00.000Z',
  );
  assert.equal(
    liveCatalogCacheKey('search-index', 'rel_1', '2026-01-01T00:00:00.000Z'),
    'search-index:rel_1:2026-01-01T00:00:00.000Z',
  );
});
