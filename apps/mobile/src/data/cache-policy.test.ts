import {
  assertCacheSafe,
  isNeverCacheKey,
  NeverCacheViolation,
  evictIfOverCeiling,
  hashSearchKey,
} from './cache-policy';
import { createMemoryStore } from './db/memory-store';
import type { CacheNamespace } from './db/store';

describe('never-cache enforcement (§9, invariant 7)', () => {
  it('flags raw query text, correction content, and precise/device location keys', () => {
    expect(isNeverCacheKey('rawQuery')).toBe(true);
    expect(isNeverCacheKey('queryText')).toBe(true);
    expect(isNeverCacheKey('q')).toBe(true);
    expect(isNeverCacheKey('correctionContent')).toBe(true);
    expect(isNeverCacheKey('correctionDraft')).toBe(true);
    expect(isNeverCacheKey('deviceLocation')).toBe(true);
    expect(isNeverCacheKey('preciseLocation')).toBe(true);
    expect(isNeverCacheKey('rawLat')).toBe(true);
  });

  it('does NOT flag legitimately-cached public fields (coarsened geo, labels)', () => {
    // ADR-022 §2: cached map GeoJSON is already API-coarsened public geometry.
    expect(isNeverCacheKey('coordinates')).toBe(false);
    expect(isNeverCacheKey('geometry')).toBe(false);
    expect(isNeverCacheKey('displayName')).toBe(false);
    expect(isNeverCacheKey('summary')).toBe(false);
    expect(isNeverCacheKey('sensitivityClass')).toBe(false);
  });

  it('assertCacheSafe throws on a nested never-cache field and names only the field', () => {
    const payload = { id: 'e1', nested: { correctionContent: 'user typed this' } };
    expect(() => assertCacheSafe(payload)).toThrow(NeverCacheViolation);
    try {
      assertCacheSafe(payload);
    } catch (err) {
      // The sensitive VALUE must never appear in the error.
      expect((err as Error).message).not.toContain('user typed this');
      expect((err as Error).message).toContain('correctionContent');
    }
  });

  it('assertCacheSafe passes clean released projection data', () => {
    expect(() =>
      assertCacheSafe({
        id: 'e1',
        displayName: 'X',
        geometry: { type: 'Point', coordinates: [-74, 40.7] },
        sensitivityClass: 'public',
      }),
    ).not.toThrow();
  });
});

describe('hashSearchKey', () => {
  it('never contains the raw query text and is salted per install', () => {
    const raw = 'sensitive person name';
    const k1 = hashSearchKey('kind=person', 'salt-A');
    const k2 = hashSearchKey('kind=person', 'salt-B');
    expect(k1).not.toContain(raw);
    expect(k1).not.toContain('person');
    expect(k1).not.toBe(k2); // different install salt ⇒ different key
    expect(k1).toBe(hashSearchKey('kind=person', 'salt-A')); // deterministic
  });
});

describe('LRU eviction (ADR-022 §2)', () => {
  async function put(store: any, key: string, bytes: number, accessedAt: number) {
    await store.put({
      namespace: 'entity' as CacheNamespace,
      key,
      value: 'x'.repeat(bytes),
      releaseStamp: 'r1',
      fetchedAt: accessedAt,
      lastAccessedAt: accessedAt,
      byteLength: bytes,
    });
  }

  it('evicts least-recently-accessed first until under the low-water mark', async () => {
    const store = createMemoryStore();
    // ceiling 100, low-water 80.
    await put(store, 'old', 40, 1); // oldest access
    await put(store, 'mid', 40, 2);
    await put(store, 'new', 40, 3); // newest — total 120 > 100
    const evicted = await evictIfOverCeiling(store, 100, 80);
    expect(evicted).toBe(1); // dropping the oldest (40) → 80, under low-water
    expect(await store.get('entity', 'old')).toBeUndefined();
    expect(await store.get('entity', 'mid')).toBeDefined();
    expect(await store.get('entity', 'new')).toBeDefined();
    expect(await store.totalBytes()).toBeLessThanOrEqual(80);
  });

  it('is a no-op under the ceiling', async () => {
    const store = createMemoryStore();
    await put(store, 'a', 10, 1);
    expect(await evictIfOverCeiling(store, 100, 80)).toBe(0);
  });
});
