/**
 * Offline-cached-pages test (MOB-015 requirement #8/#9: "offline legal access", "stale legal
 * version"). Exercises the REAL `@/data` cache primitives (`createReleaseCache` +
 * `createMemoryStore`) — not a mock of this module's own behavior — so the offline-read guarantee
 * is proven against the actual MOB-009 cache, not a stand-in.
 */
import { createMemoryStore, createReleaseCache } from '@/data';
import { createContentRepository } from './content-repository';

const STAMP_A = 'release-a@abc123';
const STAMP_B = 'release-b@def456';

function makeRepo(opts: { online: boolean; stamp: string }) {
  const store = createMemoryStore();
  const cache = createReleaseCache(store);
  let online = opts.online;
  let stamp = opts.stamp;
  const repo = createContentRepository({
    cache,
    isOnline: () => online,
    activeStamp: async () => stamp,
    now: () => 1_000_000,
  });
  return {
    repo,
    setOnline: (value: boolean) => {
      online = value;
    },
    setStamp: (value: string) => {
      stamp = value;
    },
  };
}

describe('content repository — offline cache behavior', () => {
  it('fetches a known page online and reports source "network"', async () => {
    const { repo } = makeRepo({ online: true, stamp: STAMP_A });
    const result = await repo.getPage('legal', 'privacy');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.source).toBe('network');
      expect(result.degraded).toBe(false);
      expect(result.value.page.slug).toBe('privacy');
    }
  });

  it('returns "not-found" for an unknown slug while online', async () => {
    const { repo } = makeRepo({ online: true, stamp: STAMP_A });
    const result = await repo.getPage('legal', 'does-not-exist');
    expect(result.status).toBe('not-found');
  });

  it('serves cached content offline after a prior online fetch, explicitly labeled degraded (offline legal access)', async () => {
    const { repo, setOnline } = makeRepo({ online: true, stamp: STAMP_A });
    const online = await repo.getPage('legal', 'privacy');
    expect(online.status).toBe('ok');

    setOnline(false);
    const offline = await repo.getPage('legal', 'privacy');
    expect(offline.status).toBe('ok');
    if (offline.status === 'ok') {
      expect(offline.source).toBe('cache');
      expect(offline.degraded).toBe(true);
      expect(offline.value.page.slug).toBe('privacy');
      expect(offline.value.contentVersion).toBe('content-v1');
    }
  });

  it('reports an explicit "offline-miss" rather than a silent failure when nothing is cached yet', async () => {
    const { repo } = makeRepo({ online: false, stamp: STAMP_A });
    const result = await repo.getPage('legal', 'privacy');
    expect(result.status).toBe('offline-miss');
  });

  it('drops a cached row written under a superseded release stamp (ADR-022 §4 global invalidation), reporting offline-miss rather than stale content', async () => {
    const { repo, setOnline, setStamp } = makeRepo({ online: true, stamp: STAMP_A });
    await repo.getPage('legal', 'privacy'); // cached under STAMP_A

    setStamp(STAMP_B); // simulate a new release becoming active
    setOnline(false);
    const result = await repo.getPage('legal', 'privacy');
    // The real release-cache.read() drops rows from a superseded stamp and reports a miss (T5) —
    // this is production behavior, not something this repository re-implements.
    expect(result.status).toBe('offline-miss');
  });

  it('methodology and history pages are independently cache-addressable (no key collision across sections)', async () => {
    const { repo, setOnline } = makeRepo({ online: true, stamp: STAMP_A });
    await repo.getPage('methodology', 'overview');
    await repo.getPage('history', 'basement-to-m-street');
    setOnline(false);
    const methodology = await repo.getPage('methodology', 'overview');
    const history = await repo.getPage('history', 'basement-to-m-street');
    expect(methodology.status).toBe('ok');
    expect(history.status).toBe('ok');
    if (methodology.status === 'ok' && history.status === 'ok') {
      expect(methodology.value.page.slug).toBe('overview');
      expect(history.value.page.slug).toBe('basement-to-m-street');
    }
  });
});
