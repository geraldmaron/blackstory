import {
  createReleaseCache,
  ArtifactVerificationError,
  PayloadTooLargeError,
} from './release-cache';
import { createMemoryStore } from './db/memory-store';
import { sha256Hex } from './hashing';
import type { ManifestArtifactHashRef } from './contracts';

const META = { releaseStamp: 'rel-1', fetchedAt: 1000 };

describe('release-coupled read/write servability (§4, T5)', () => {
  it('reads back a value written under the active stamp', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.write('entity', 'e1', { id: 'e1', name: 'X' }, META);
    const r = await cache.read<{ id: string }>('entity', 'e1', {
      activeStamp: 'rel-1',
      degraded: false,
      now: 2000,
    });
    expect(r?.value.id).toBe('e1');
    expect(r?.freshness).toMatchObject({ source: 'cache', fetchedAt: 1000, degraded: false });
  });

  it('DROPS and misses a row from a superseded release (rollback-replay)', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.write('entity', 'e1', { id: 'e1' }, { releaseStamp: 'rel-1', fetchedAt: 1000 });
    // Server is now on rel-2 (roll-forward) — the rel-1 row must not be served.
    const r = await cache.read('entity', 'e1', { activeStamp: 'rel-2', degraded: false, now: 2000 });
    expect(r).toBeUndefined();
    expect(await store.get('entity', 'e1')).toBeUndefined(); // dropped, not lingering

    // Rollback to an OLDER stamp must also miss (equality, not ordering).
    await cache.write('entity', 'e2', { id: 'e2' }, { releaseStamp: 'rel-5', fetchedAt: 1000 });
    const back = await cache.read('entity', 'e2', { activeStamp: 'rel-3', degraded: false, now: 2000 });
    expect(back).toBeUndefined();
  });

  it('surfaces degraded=true when read while offline', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.write('entity', 'e1', { id: 'e1' }, META);
    const r = await cache.read('entity', 'e1', { activeStamp: 'rel-1', degraded: true, now: 2000 });
    expect(r?.freshness.degraded).toBe(true);
  });
});

describe('global release-stamp invalidation (§4)', () => {
  it('deletes release-coupled rows from other stamps and records the new stamp', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.write('entity', 'a', { id: 'a' }, { releaseStamp: 'rel-1', fetchedAt: 1 });
    await cache.write('map', 'b', { t: 1 }, { releaseStamp: 'rel-1', fetchedAt: 1 });
    await cache.write('entity', 'c', { id: 'c' }, { releaseStamp: 'rel-2', fetchedAt: 1 });

    const removed = await cache.applyReleaseStamp('rel-2', 5000);
    expect(removed).toBe(2); // the two rel-1 rows
    expect(await cache.getActiveStamp()).toBe('rel-2');
    expect(await store.get('entity', 'c')).toBeDefined();
  });
});

describe('artifact verification (§5)', () => {
  const good = JSON.stringify({ artifact: 'payload' });
  const declared: ManifestArtifactHashRef = {
    path: 'a.json',
    hash: sha256Hex(good),
    byteLength: good.length,
  };

  it('commits an artifact whose hash matches the manifest', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.verifyAndWriteArtifact('a', good, declared, META);
    const r = await cache.read<{ artifact: string }>('artifact', 'a', {
      activeStamp: 'rel-1',
      degraded: false,
      now: 2,
    });
    expect(r?.value.artifact).toBe('payload');
  });

  it('REJECTS a tampered artifact and keeps the last-known-good copy', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.verifyAndWriteArtifact('a', good, declared, META); // last-known-good

    const tampered = JSON.stringify({ artifact: 'evil' });
    await expect(cache.verifyAndWriteArtifact('a', tampered, declared, META)).rejects.toBeInstanceOf(
      ArtifactVerificationError,
    );
    // The good copy must survive the rejected write.
    const r = await cache.read<{ artifact: string }>('artifact', 'a', {
      activeStamp: 'rel-1',
      degraded: false,
      now: 2,
    });
    expect(r?.value.artifact).toBe('payload');
  });
});

describe('oversized payload guard', () => {
  it('rejects a maliciously large entry before it can bloat the cache', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    const huge = { blob: 'a'.repeat(5 * 1024 * 1024) };
    await expect(cache.write('entity', 'big', huge, META)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(await store.get('entity', 'big')).toBeUndefined();
  });
});
