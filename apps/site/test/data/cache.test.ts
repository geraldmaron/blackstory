import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  createCatalogCache,
  listCaches,
  resetCacheRegistryForTests,
} from '../../src/server/data/cache';

const REL = { releaseId: 'rel_1', activatedAt: '2026-10-01T00:00:00.000Z' };
const quiet = () => {};

function clock(start = 1_000_000) {
  let at = start;
  return { now: () => at, advance: (ms: number) => void (at += ms) };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => resetCacheRegistryForTests());

test('a miss loads once; later reads are memory hits', async () => {
  const c = createCatalogCache<string>({ kind: 'k', log: quiet });
  let loads = 0;
  const load = async () => ((loads += 1), 'value');
  assert.equal(await c.get(REL, load), 'value');
  assert.equal(await c.get(REL, load), 'value');
  assert.equal(await c.get(REL, load), 'value');
  assert.equal(loads, 1);
  const stats = c.stats();
  assert.deepEqual([stats.hits, stats.misses, stats.loads, stats.entries], [2, 1, 1, 1]);
});

test('concurrent misses share one load (single-flight)', async () => {
  const c = createCatalogCache<number>({ kind: 'k', log: quiet });
  let loads = 0;
  const load = async () => {
    loads += 1;
    await tick();
    return 7;
  };
  const results = await Promise.all(Array.from({ length: 25 }, () => c.get(REL, load)));
  assert.deepEqual(new Set(results), new Set([7]));
  assert.equal(loads, 1);
});

test('a new release is a new key: nothing is served across releases', async () => {
  const c = createCatalogCache<string>({ kind: 'k', log: quiet });
  assert.equal(await c.get(REL, async () => 'old'), 'old');
  const next = { releaseId: 'rel_2', activatedAt: '2026-10-02T00:00:00.000Z' };
  assert.equal(await c.get(next, async () => 'new'), 'new');
  assert.equal(
    await c.get(REL, async () => 'reloaded'),
    'old',
    'the old release still has its own entry until it expires',
  );
  const sameIdNewActivation = { releaseId: 'rel_1', activatedAt: '2026-10-03T00:00:00.000Z' };
  assert.equal(
    await c.get(sameIdNewActivation, async () => 'reactivated'),
    'reactivated',
    'a re-activation is a new key too',
  );
});

test('an undefined load is returned and never cached', async () => {
  const c = createCatalogCache<string>({ kind: 'k', log: quiet });
  let loads = 0;
  assert.equal(await c.get(REL, async () => ((loads += 1), undefined)), undefined);
  assert.equal(await c.get(REL, async () => ((loads += 1), 'now')), 'now');
  assert.equal(loads, 2);
});

test('past the soft TTL the stale value is served at once and exactly one refresh runs', async () => {
  const t = clock();
  const c = createCatalogCache<string>({
    kind: 'k',
    now: t.now,
    softTtlMs: 1_000,
    ttlMs: 60_000,
    log: quiet,
  });
  await c.get(REL, async () => 'v1');
  t.advance(1_500);
  let refreshes = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const refresh = async () => {
    refreshes += 1;
    await gate;
    return 'v2';
  };
  const served = await Promise.all([c.get(REL, refresh), c.get(REL, refresh), c.get(REL, refresh)]);
  assert.deepEqual(served, ['v1', 'v1', 'v1'], 'readers are never blocked on the refresh');
  assert.equal(refreshes, 1, 'one refresh for three readers');
  release();
  await tick();
  await tick();
  assert.equal(
    await c.get(REL, async () => 'unused'),
    'v2',
    'the refreshed value replaces the stale one',
  );
  assert.equal(c.stats().refreshes, 1);
});

test('a failed background refresh keeps serving the current value and is counted', async () => {
  const t = clock();
  const messages: string[] = [];
  const c = createCatalogCache<string>({
    kind: 'k',
    now: t.now,
    softTtlMs: 1_000,
    ttlMs: 60_000,
    log: (m) => messages.push(m),
  });
  await c.get(REL, async () => 'v1');
  t.advance(2_000);
  assert.equal(
    await c.get(REL, async () => {
      throw new Error('boom');
    }),
    'v1',
  );
  await tick();
  await tick();
  assert.equal(
    await c.get(REL, async () => 'v3'),
    'v1',
    'still the old value; the next read past the soft TTL retries',
  );
  assert.equal(c.stats().errors >= 1, true);
  assert.ok(messages.some((m) => m.includes('background refresh failed')));
});

test('past the hard TTL the entry is gone and the next read loads', async () => {
  const t = clock();
  const c = createCatalogCache<string>({
    kind: 'k',
    now: t.now,
    softTtlMs: 1_000,
    ttlMs: 5_000,
    log: quiet,
  });
  await c.get(REL, async () => 'v1');
  t.advance(6_000);
  assert.equal(await c.get(REL, async () => 'v2'), 'v2');
});

test('stale-if-error: a failed load serves the last good value inside the window and throws outside it', async () => {
  const t = clock();
  const c = createCatalogCache<string>({
    kind: 'k',
    now: t.now,
    ttlMs: 5_000,
    softTtlMs: 5_000,
    staleIfErrorMs: 60_000,
    log: quiet,
  });
  await c.get(REL, async () => 'good');
  t.advance(10_000);
  assert.equal(
    await c.get(REL, async () => {
      throw new Error('db down');
    }),
    'good',
  );
  assert.equal(c.stats().staleServed, 1);
  t.advance(120_000);
  await assert.rejects(
    c.get(REL, async () => {
      throw new Error('db down');
    }),
    /db down/,
  );
});

test('without any last good value a failed load throws', async () => {
  const c = createCatalogCache<string>({ kind: 'k', log: quiet });
  await assert.rejects(
    c.get(REL, async () => {
      throw new Error('first load fails');
    }),
    /first load fails/,
  );
  assert.equal(c.stats().errors, 1);
});

test('invalidate drops the entry and the stale-if-error copy, and reports how many', async () => {
  const t = clock();
  const c = createCatalogCache<string>({ kind: 'k', now: t.now, ttlMs: 5_000, log: quiet });
  await c.get(REL, async () => 'good');
  assert.equal(c.invalidate(), 1);
  assert.equal(c.invalidate(), 0);
  await assert.rejects(
    c.get(REL, async () => {
      throw new Error('down after purge');
    }),
    /down after purge/,
    'a purge means: do not serve what you had',
  );
  assert.equal(await c.get(REL, async () => 'fresh'), 'fresh');
});

test('every cache registers by kind so a purge can reach it', async () => {
  createCatalogCache<string>({ kind: 'a', log: quiet });
  createCatalogCache<string>({ kind: 'b', log: quiet });
  assert.deepEqual(
    listCaches()
      .map((c) => c.kind)
      .sort(),
    ['a', 'b'],
  );
});

test('stats report the last load', async () => {
  const t = clock(Date.parse('2026-10-16T12:00:00.000Z'));
  const c = createCatalogCache<string>({ kind: 'k', now: t.now, log: quiet });
  await c.get(REL, async () => {
    t.advance(250);
    return 'x';
  });
  const s = c.stats();
  assert.equal(s.lastLoadMs, 250);
  assert.equal(s.lastLoadedAt, '2026-10-16T12:00:00.250Z');
  assert.equal(s.lastKey, JSON.stringify(['k', 'rel_1', '2026-10-01T00:00:00.000Z']));
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

test('a purge fences a load already in flight: it answers its caller but cannot refill the cache', async () => {
  const c = createCatalogCache<string>({ kind: 'k', log: quiet });
  const slow = deferred<string>();
  const inFlight = c.get(REL, () => slow.promise);
  await tick();
  c.invalidate();
  slow.resolve('withdrawn');
  assert.equal(await inFlight, 'withdrawn', 'the waiting caller still gets its answer');
  assert.equal(
    await c.get(REL, async () => 'fresh'),
    'fresh',
    'but the purged value was not stored',
  );
  assert.equal(c.stats().discarded, 1);
});

test('a reader after a purge never joins a load that started before it', async () => {
  const c = createCatalogCache<string>({ kind: 'k', log: quiet });
  const old = deferred<string>();
  const before = c.get(REL, () => old.promise);
  await tick();
  c.invalidate();
  let freshLoads = 0;
  const after = await c.get(REL, async () => ((freshLoads += 1), 'corrected'));
  assert.equal(after, 'corrected');
  assert.equal(freshLoads, 1);
  old.resolve('stale');
  assert.equal(await before, 'stale');
  assert.equal(
    await c.get(REL, async () => 'unused'),
    'corrected',
    'the pre-purge load did not overwrite the corrected value',
  );
});

test('after hard expiry a reader joins the refresh that is already running instead of starting a second load', async () => {
  const t = clock();
  const c = createCatalogCache<string>({
    kind: 'k',
    now: t.now,
    softTtlMs: 1_000,
    ttlMs: 5_000,
    log: quiet,
  });
  await c.get(REL, async () => 'v1');
  t.advance(2_000);
  const slowRefresh = deferred<string>();
  let started = 0;
  await c.get(REL, () => ((started += 1), slowRefresh.promise));
  t.advance(10_000);
  let secondLoads = 0;
  const reader = c.get(REL, async () => ((secondLoads += 1), 'v3'));
  await tick();
  slowRefresh.resolve('v2');
  assert.equal(await reader, 'v2', 'the reader shares the running load');
  assert.deepEqual([started, secondLoads], [1, 0], 'one load for everyone');
  assert.equal(await c.get(REL, async () => 'unused'), 'v2');
});

test('the stale-if-error copy of the live release survives an older release finishing', async () => {
  const t = clock();
  const c = createCatalogCache<string>({
    kind: 'k',
    now: t.now,
    ttlMs: 5_000,
    softTtlMs: 5_000,
    staleIfErrorMs: 60_000,
    log: quiet,
  });
  const REL_B = { releaseId: 'rel_2', activatedAt: '2026-10-02T00:00:00.000Z' };
  const slowA = deferred<string>();
  const a = c.get(REL, () => slowA.promise);
  await c.get(REL_B, async () => 'B');
  slowA.resolve('A');
  await a;
  t.advance(10_000);
  assert.equal(
    await c.get(REL_B, async () => {
      throw new Error('down');
    }),
    'B',
    "B's fallback was not cleared by A finishing",
  );
});

test('only the two most recent releases keep a stale-if-error copy', async () => {
  const t = clock();
  const c = createCatalogCache<string>({
    kind: 'k',
    now: t.now,
    ttlMs: 1_000,
    softTtlMs: 1_000,
    staleIfErrorMs: 600_000,
    log: quiet,
  });
  const rel = (n: number) => ({
    releaseId: `rel_${n}`,
    activatedAt: `2026-10-0${n}T00:00:00.000Z`,
  });
  for (const n of [1, 2, 3]) await c.get(rel(n), async () => `v${n}`);
  t.advance(5_000);
  await assert.rejects(
    c.get(rel(1), async () => {
      throw new Error('down');
    }),
    /down/,
    'the oldest release was evicted',
  );
  assert.equal(
    await c.get(rel(3), async () => {
      throw new Error('down');
    }),
    'v3',
  );
});

test('a failing refresh backs off instead of retrying at request rate', async () => {
  const t = clock();
  const c = createCatalogCache<string>({
    kind: 'k',
    now: t.now,
    softTtlMs: 1_000,
    ttlMs: 600_000,
    log: quiet,
  });
  await c.get(REL, async () => 'v1');
  t.advance(2_000);
  let attempts = 0;
  const failing = async (): Promise<string> => {
    attempts += 1;
    throw new Error('source down');
  };
  for (let i = 0; i < 6; i += 1) {
    assert.equal(await c.get(REL, failing), 'v1');
    await tick();
    await tick();
  }
  assert.equal(attempts, 1, 'six reads, one attempt: the rest are inside the backoff window');
  t.advance(11_000);
  await c.get(REL, failing);
  await tick();
  await tick();
  assert.equal(attempts, 2, 'after the first backoff the next read retries once');
  t.advance(15_000);
  await c.get(REL, failing);
  await tick();
  assert.equal(
    attempts,
    2,
    'the second backoff is longer (20 s), so 15 s later it is still waiting',
  );
});

test('a successful refresh clears the backoff', async () => {
  const t = clock();
  const c = createCatalogCache<string>({
    kind: 'k',
    now: t.now,
    softTtlMs: 1_000,
    ttlMs: 600_000,
    log: quiet,
  });
  await c.get(REL, async () => 'v1');
  t.advance(2_000);
  await c.get(REL, async () => {
    throw new Error('x');
  });
  await tick();
  await tick();
  t.advance(11_000);
  await c.get(REL, async () => 'v2');
  await tick();
  await tick();
  t.advance(2_000);
  let attempts = 0;
  await c.get(REL, async () => ((attempts += 1), 'v3'));
  await tick();
  await tick();
  assert.equal(attempts, 1, 'no backoff left after the success');
});

test('a refresh that rejects never becomes an unhandled rejection', async () => {
  const t = clock();
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    const c = createCatalogCache<string>({
      kind: 'k',
      now: t.now,
      softTtlMs: 1_000,
      ttlMs: 600_000,
      log: quiet,
    });
    await c.get(REL, async () => 'v1');
    t.advance(2_000);
    await c.get(REL, async () => {
      throw new Error('nope');
    });
    await tick();
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 10));
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
  assert.deepEqual(unhandled, []);
});

test('different (release, scope) pairs never share a key, whatever separators the ids contain', async () => {
  const c = createCatalogCache<string>({ kind: 'k', log: quiet });
  const T = '2026-10-16T00:00:00.000Z';
  const a = { releaseId: 'r', activatedAt: T };
  const b = { releaseId: `r:${T}:s`, activatedAt: T };
  assert.equal(await c.get(a, async () => 'A', `s:${T}:x`), 'A');
  assert.equal(
    await c.get(b, async () => 'B', 'x'),
    'B',
    "a different release must load, not read the first release's entry",
  );
  assert.equal(await c.get(a, async () => 'unused', `s:${T}:x`), 'A');
});

test('entries that opt out of stale-if-error are not served after an error', async () => {
  const t = clock();
  const c = createCatalogCache<{ v: string | null }>({
    kind: 'k',
    now: t.now,
    ttlMs: 1_000,
    softTtlMs: 1_000,
    staleIfErrorMs: 600_000,
    log: quiet,
    staleEligible: (x) => x.v !== null,
  });
  await c.get(REL, async () => ({ v: null }), 'miss');
  await c.get(REL, async () => ({ v: 'hit' }), 'hit');
  t.advance(5_000);
  await assert.rejects(
    c.get(
      REL,
      async () => {
        throw new Error('db down');
      },
      'miss',
    ),
    /db down/,
  );
  assert.deepEqual(
    await c.get(
      REL,
      async () => {
        throw new Error('db down');
      },
      'hit',
    ),
    { v: 'hit' },
  );
});

test('refresh-failure bookkeeping stays bounded however many distinct keys fail', async () => {
  const t = clock();
  const c = createCatalogCache<string>({
    kind: 'k',
    now: t.now,
    softTtlMs: 1_000,
    ttlMs: 600_000,
    maxEntries: 5_000,
    lastGoodMaxKeys: 0,
    log: quiet,
  });
  for (let i = 0; i < 1_300; i += 1) {
    await c.get(REL, async () => `v${i}`, `id-${i}`);
    t.advance(2_000);
    await c.get(
      REL,
      async () => {
        throw new Error('down');
      },
      `id-${i}`,
    );
  }
  await tick();
  assert.ok(c.stats().backoffKeys <= 1_000, `backoff keys ${c.stats().backoffKeys}`);
  assert.ok(c.stats().backoffKeys > 900, 'and it does track recent failures');
});
