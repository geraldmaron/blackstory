import { createManualConnectivity } from './offline';
import { createBootstrapSynchronizer } from './bootstrap-sync';
import { createReleaseCache } from './release-cache';
import { createMemoryStore } from './db/memory-store';
import type { Transport, ReadResult } from './transport';

describe('connectivity signal', () => {
  it('treats unknown as online for the attempt, offline as offline, and notifies subscribers', () => {
    const conn = createManualConnectivity('unknown');
    expect(conn.isOnline()).toBe(true); // never refuse to try just because unknown
    const seen: string[] = [];
    const unsub = conn.subscribe((s) => seen.push(s));
    conn.set('offline');
    expect(conn.isOnline()).toBe(false);
    conn.set('online');
    expect(conn.isOnline()).toBe(true);
    unsub();
    conn.set('offline');
    expect(seen).toEqual(['offline', 'online']); // no notification after unsubscribe
  });
});

describe('offline-first launch (no cache, no network) degrades gracefully', () => {
  it('does not crash: sync reports offline, reads miss cleanly', async () => {
    const store = createMemoryStore(); // fresh, empty — first launch
    const cache = createReleaseCache(store);

    const offlineTransport: Transport = {
      async readJson<T>(): Promise<ReadResult<T>> {
        throw new Error('no connectivity');
      },
      async mutate() {
        throw new Error('no connectivity');
      },
    };
    const sync = createBootstrapSynchronizer({ transport: offlineTransport, cache, store, now: () => 1 });

    const result = await sync.sync();
    expect(result.status).toBe('offline');
    expect(result.stamp).toBeUndefined(); // never fetched a release yet

    // A read with no cached data and no active stamp must simply miss — not throw.
    const r = await cache.read('entity', 'missing', {
      activeStamp: 'whatever',
      degraded: true,
      now: 2,
    });
    expect(r).toBeUndefined();
  });
});
