/**
 * `createReleaseScopedCache`: the one cross-request path every release-wide public read takes.
 * Uses the injected `nextCache` seam so the suite runs without Next's runtime; the fake below
 * behaves like `unstable_cache` for these purposes (keyed store, factory runs on miss).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReleaseScopedCache, type NextCacheLike } from './release-scoped-cache';
import { NEXT_DATA_CACHE_SAFE_BYTES } from './live-catalog-cache';

function fakeNextCache(): { readonly cache: NextCacheLike; readonly store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  const cache: NextCacheLike = (fn, keyParts) => async () => {
    const key = keyParts.join('|');
    if (store.has(key)) return store.get(key) as Awaited<ReturnType<typeof fn>>;
    const value = await fn();
    if (value !== undefined) store.set(key, value);
    return value;
  };
  return { cache, store };
}

const release = { releaseId: 'rel_1', activatedAt: '2026-09-01T00:00:00Z' };

test('loads once per release key, then serves memory', async () => {
  const { cache } = fakeNextCache();
  const scoped = createReleaseScopedCache<readonly string[]>({
    kind: 'k',
    deps: { nextCache: cache },
  });
  let loads = 0;
  const load = async () => {
    loads += 1;
    return ['a'];
  };
  assert.deepEqual(await scoped.get(release, load), ['a']);
  assert.deepEqual(await scoped.get(release, load), ['a']);
  assert.equal(loads, 1);
});

test('a new release key misses; the old one stays served', async () => {
  const { cache } = fakeNextCache();
  const scoped = createReleaseScopedCache<string>({ kind: 'k', deps: { nextCache: cache } });
  let loads = 0;
  const load = async () => `v${(loads += 1)}`;
  assert.equal(await scoped.get(release, load), 'v1');
  assert.equal(await scoped.get({ ...release, activatedAt: '2026-09-02T00:00:00Z' }, load), 'v2');
  assert.equal(await scoped.get(release, load), 'v1');
  assert.equal(loads, 2);
});

test('concurrent misses on one key share a single load', async () => {
  const { cache } = fakeNextCache();
  const scoped = createReleaseScopedCache<number>({ kind: 'k', deps: { nextCache: cache } });
  let loads = 0;
  let release_: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release_ = resolve;
  });
  const load = async () => {
    loads += 1;
    await gate;
    return 42;
  };
  const pending = [scoped.get(release, load), scoped.get(release, load), scoped.get(release, load)];
  release_();
  assert.deepEqual(await Promise.all(pending), [42, 42, 42]);
  assert.equal(loads, 1);
});

test('undefined from load is not cached; the next call retries', async () => {
  const { cache, store } = fakeNextCache();
  const scoped = createReleaseScopedCache<string>({ kind: 'k', deps: { nextCache: cache } });
  let loads = 0;
  const load = async () => {
    loads += 1;
    return loads === 1 ? undefined : 'ready';
  };
  assert.equal(await scoped.get(release, load), undefined);
  assert.equal(store.size, 0);
  assert.equal(await scoped.get(release, load), 'ready');
  assert.equal(loads, 2);
});

test('a load failure propagates and leaves nothing cached', async () => {
  const { cache, store } = fakeNextCache();
  const scoped = createReleaseScopedCache<string>({ kind: 'k', deps: { nextCache: cache } });
  await assert.rejects(
    scoped.get(release, async () => {
      throw new Error('db down');
    }),
    /db down/,
  );
  assert.equal(store.size, 0);
  assert.equal(await scoped.get(release, async () => 'recovered'), 'recovered');
});

test('a value over the Next data-cache ceiling stays in memory and stores only a sentinel', async () => {
  const { cache, store } = fakeNextCache();
  const scoped = createReleaseScopedCache<readonly string[]>({
    kind: 'k',
    deps: { nextCache: cache },
  });
  const fat = Array.from({ length: NEXT_DATA_CACHE_SAFE_BYTES / 2 + 1 }, () => 'x');
  let loads = 0;
  const load = async () => {
    loads += 1;
    return fat;
  };
  assert.equal(await scoped.get(release, load), fat);
  const stored = [...store.values()];
  assert.equal(stored.length, 1);
  assert.deepEqual(stored[0], { __liveCatalog: 'oversized' });
  // Memory now serves it; the sentinel in Next never reaches a caller.
  assert.equal(await scoped.get(release, load), fat);
  assert.equal(loads, 1);
});

test('a sentinel already in Next (another instance found it oversized) triggers a local load', async () => {
  const { cache, store } = fakeNextCache();
  store.set(['k', release.releaseId, release.activatedAt].join('|'), {
    __liveCatalog: 'oversized',
  });
  const scoped = createReleaseScopedCache<readonly string[]>({
    kind: 'k',
    deps: { nextCache: cache },
  });
  let loads = 0;
  const load = async () => {
    loads += 1;
    return ['local'];
  };
  assert.deepEqual(await scoped.get(release, load), ['local']);
  assert.deepEqual(await scoped.get(release, load), ['local']);
  assert.equal(loads, 1);
});
