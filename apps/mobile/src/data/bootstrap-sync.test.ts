import { createBootstrapSynchronizer, deriveEndpointStamp } from './bootstrap-sync';
import { createReleaseCache } from './release-cache';
import { createMemoryStore } from './db/memory-store';
import type { BootstrapResponseV1 } from './contracts';
import type { Transport, ReadResult } from './transport';

function bootstrap(releaseId: string): BootstrapResponseV1 {
  return {
    apiVersion: 'v1',
    minSupportedApiVersion: 'v1',
    deprecationWindowDays: 30,
    activeRelease: { releaseId, generatedAt: '2026-07-19T00:00:00Z', recordUpdatedAt: '2026-07-19T00:00:00Z' },
  };
}

/** Transport double returning a scripted sequence of read results. */
function scriptedTransport(results: (ReadResult<BootstrapResponseV1> | Error)[]): {
  transport: Transport;
  count: () => number;
} {
  let i = 0;
  return {
    count: () => i,
    transport: {
      async readJson<T>(): Promise<ReadResult<T>> {
        const next = results[Math.min(i, results.length - 1)];
        i++;
        if (next instanceof Error) throw next;
        return next as unknown as ReadResult<T>;
      },
      async mutate() {
        throw new Error('not used');
      },
    },
  };
}

function ok(releaseId: string, etag = '"e"'): ReadResult<BootstrapResponseV1> {
  return { kind: 'ok', status: 200, data: bootstrap(releaseId), etag };
}

describe('bootstrap sync (§4, T5/T7)', () => {
  it('invalidates release-coupled cache when the stamp advances', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.write('entity', 'e1', { id: 'e1' }, { releaseStamp: 'rel-1', fetchedAt: 1 });
    await cache.applyReleaseStamp('rel-1', 1);

    const { transport } = scriptedTransport([ok('rel-2')]);
    const sync = createBootstrapSynchronizer({ transport, cache, store, now: () => 5000 });
    const result = await sync.sync();

    expect(result).toMatchObject({ status: 'invalidated', stamp: 'rel-2', rowsInvalidated: 1 });
    expect(await cache.getActiveStamp()).toBe('rel-2');
  });

  it('rollback to a DIFFERENT prior release also invalidates (equality, not ordering)', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.applyReleaseStamp('rel-5', 1);
    await cache.write('entity', 'e', { id: 'e' }, { releaseStamp: 'rel-5', fetchedAt: 1 });

    const { transport } = scriptedTransport([ok('rel-3')]); // server rolled BACK
    const sync = createBootstrapSynchronizer({ transport, cache, store, now: () => 9000 });
    const result = await sync.sync();
    expect(result.status).toBe('invalidated');
    expect(await cache.getActiveStamp()).toBe('rel-3');
    expect(await store.get('entity', 'e')).toBeUndefined();
  });

  it('reports unchanged when the stamp matches', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.applyReleaseStamp('rel-2', 1);
    const { transport } = scriptedTransport([ok('rel-2')]);
    const sync = createBootstrapSynchronizer({ transport, cache, store, now: () => 5000 });
    expect((await sync.sync()).status).toBe('unchanged');
  });

  it('handles a 304 not-modified without invalidating', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.applyReleaseStamp('rel-2', 1);
    const { transport } = scriptedTransport([{ kind: 'not-modified', status: 304, etag: '"e"' }]);
    const sync = createBootstrapSynchronizer({ transport, cache, store, now: () => 5000 });
    const r = await sync.sync();
    expect(r.status).toBe('not-modified');
    expect(await cache.getActiveStamp()).toBe('rel-2'); // untouched
  });

  it('OFFLINE: keeps the last-known stamp and does not invalidate (T7)', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    await cache.applyReleaseStamp('rel-2', 1);
    await cache.write('entity', 'e', { id: 'e' }, { releaseStamp: 'rel-2', fetchedAt: 1 });
    const { transport } = scriptedTransport([new Error('network down')]);
    const sync = createBootstrapSynchronizer({ transport, cache, store, now: () => 5000 });
    const r = await sync.sync();
    expect(r).toMatchObject({ status: 'offline', stamp: 'rel-2' });
    expect(await store.get('entity', 'e')).toBeDefined(); // cache preserved
  });

  it('single-flights concurrent/duplicate sync attempts onto one request', async () => {
    const store = createMemoryStore();
    const cache = createReleaseCache(store);
    const { transport, count } = scriptedTransport([ok('rel-1')]);
    const sync = createBootstrapSynchronizer({ transport, cache, store, now: () => 1 });
    const [a, b, c] = await Promise.all([sync.sync(), sync.sync(), sync.sync()]);
    expect(count()).toBe(1); // only ONE network call for three concurrent callers
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('deriveEndpointStamp uses the active release id', () => {
    expect(deriveEndpointStamp(bootstrap('rel-42'))).toBe('rel-42');
  });
});
