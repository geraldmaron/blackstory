/**
 * `fetchEntityDetail` tests with fully injected fakes — no SQLite, no NetInfo, no App Check.
 * Mirrors the dependency-injection style every module in `apps/mobile/src/data/*.test.ts`
 * already uses.
 */
import { TransportError } from '@/data';
import type { Connectivity } from '@/data';
import { fetchEntityDetail, type EntityDataDeps } from '../dataClient';
import { fullEntityFixture } from '../testFixtures';

function fakeConnectivity(online: boolean): Connectivity {
  return {
    getState: () => (online ? 'online' : 'offline'),
    isOnline: () => online,
    subscribe: () => () => {},
  };
}

function makeDeps(overrides: Partial<EntityDataDeps> = {}): EntityDataDeps {
  return {
    transport: { readJson: jest.fn() },
    releaseCache: {
      getActiveStamp: jest.fn().mockResolvedValue(undefined),
      applyReleaseStamp: jest.fn().mockResolvedValue(0),
      write: jest.fn().mockResolvedValue(undefined),
      verifyAndWriteArtifact: jest.fn().mockResolvedValue(undefined),
      read: jest.fn().mockResolvedValue(undefined),
    },
    store: { delete: jest.fn().mockResolvedValue(undefined) },
    connectivity: fakeConnectivity(true),
    now: () => 1_753_000_000_000,
    ...overrides,
  };
}

describe('fetchEntityDetail — network path', () => {
  it('returns ready/network on a successful fetch and writes through to cache', async () => {
    const raw = fullEntityFixture('place');
    const deps = makeDeps({
      transport: { readJson: jest.fn().mockResolvedValue({ kind: 'ok', data: raw }) },
    });

    const result = await fetchEntityDetail('ent_place_full_001', deps);

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.entity.id).toBe('ent_place_full_001');
      expect(result.freshness.source).toBe('network');
      expect(result.freshness.degraded).toBe(false);
    }
    expect(deps.releaseCache.applyReleaseStamp).toHaveBeenCalledWith('rel_2026_07_19_01', expect.any(Number));
    expect(deps.releaseCache.write).toHaveBeenCalledWith('entity', 'ent_place_full_001', raw, expect.objectContaining({ releaseStamp: 'rel_2026_07_19_01' }));
  });

  it('treats an unreadable response body as a rendering error, not a crash', async () => {
    const deps = makeDeps({
      transport: { readJson: jest.fn().mockResolvedValue({ kind: 'ok', data: {} }) },
    });
    const result = await fetchEntityDetail('ent_bad', deps);
    expect(result.status).toBe('error');
  });

  it('a caching failure never fails the render — the network result still returns ready', async () => {
    const raw = fullEntityFixture('place');
    const deps = makeDeps({
      transport: { readJson: jest.fn().mockResolvedValue({ kind: 'ok', data: raw }) },
      releaseCache: {
        getActiveStamp: jest.fn().mockResolvedValue(undefined),
        applyReleaseStamp: jest.fn().mockRejectedValue(new Error('disk full')),
        write: jest.fn().mockRejectedValue(new Error('disk full')),
        verifyAndWriteArtifact: jest.fn(),
        read: jest.fn().mockResolvedValue(undefined),
      },
    });
    const result = await fetchEntityDetail('ent_place_full_001', deps);
    expect(result.status).toBe('ready');
  });
});

describe('fetchEntityDetail — 404 (withdrawn or never existed, indistinguishable by design)', () => {
  it('returns not-found and evicts any lingering cached copy', async () => {
    const deps = makeDeps({
      transport: {
        readJson: jest.fn().mockRejectedValue(new TransportError('HTTP 404', { kind: 'http', status: 404, attempts: 1 })),
      },
    });
    const result = await fetchEntityDetail('ent_withdrawn_999', deps);
    expect(result.status).toBe('not-found');
    expect(deps.store.delete).toHaveBeenCalledWith('entity', 'ent_withdrawn_999');
  });
});

describe('fetchEntityDetail — network failure with a cache fallback', () => {
  it('serves a degraded cached copy on a non-404 transport failure when one exists', async () => {
    const raw = fullEntityFixture('place');
    const deps = makeDeps({
      transport: { readJson: jest.fn().mockRejectedValue(new TransportError('network down', { kind: 'network', attempts: 4 })) },
      releaseCache: {
        getActiveStamp: jest.fn().mockResolvedValue('rel_2026_07_19_01'),
        applyReleaseStamp: jest.fn(),
        write: jest.fn(),
        verifyAndWriteArtifact: jest.fn(),
        read: jest.fn().mockResolvedValue({
          value: raw,
          freshness: { source: 'cache', fetchedAt: 1_752_000_000_000, releaseStamp: 'rel_2026_07_19_01', degraded: true },
        }),
      },
    });
    const result = await fetchEntityDetail('ent_place_full_001', deps);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.freshness.source).toBe('cache');
      expect(result.freshness.degraded).toBe(true);
      expect(result.freshness.fetchedAt).toBe(1_752_000_000_000);
    }
  });

  it('returns a generic error (never a crash) on a non-404 failure with no cache to fall back to', async () => {
    const deps = makeDeps({
      transport: { readJson: jest.fn().mockRejectedValue(new TransportError('server error', { kind: 'http', status: 500, attempts: 1 })) },
    });
    const result = await fetchEntityDetail('ent_place_full_001', deps);
    expect(result.status).toBe('error');
  });
});

describe('fetchEntityDetail — offline', () => {
  it('serves cache while offline, marked degraded, without ever calling the network', async () => {
    const raw = fullEntityFixture('school');
    const readJson = jest.fn();
    const deps = makeDeps({
      transport: { readJson },
      connectivity: fakeConnectivity(false),
      releaseCache: {
        getActiveStamp: jest.fn().mockResolvedValue('rel_2026_07_19_01'),
        applyReleaseStamp: jest.fn(),
        write: jest.fn(),
        verifyAndWriteArtifact: jest.fn(),
        read: jest.fn().mockResolvedValue({
          value: raw,
          freshness: { source: 'cache', fetchedAt: 1_752_000_000_000, releaseStamp: 'rel_2026_07_19_01', degraded: true },
        }),
      },
    });
    const result = await fetchEntityDetail('ent_school_full_001', deps);
    expect(readJson).not.toHaveBeenCalled();
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.freshness.degraded).toBe(true);
  });

  it('reports offline-no-cache honestly when nothing has ever been cached (never a fabricated result)', async () => {
    const deps = makeDeps({ connectivity: fakeConnectivity(false) });
    const result = await fetchEntityDetail('ent_never_viewed', deps);
    expect(result.status).toBe('offline-no-cache');
  });
});
