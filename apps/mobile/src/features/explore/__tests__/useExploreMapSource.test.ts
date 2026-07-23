/**
 * Unit tests for the Explore map source hook — live fetch, __DEV__ demo fallback, retry.
 */
jest.mock('@/runtime', () => {
  const refreshBootstrapSync = jest.fn();
  return {
    useAppRuntimeOptional: jest.fn(() => null),
    useRefreshBootstrapSync: jest.fn(() => refreshBootstrapSync),
  };
});

jest.mock('@/security', () => ({
  DEFAULT_API_BASE_URL: 'https://api.example.com',
  resolveApiBaseUrl: jest.fn(() => 'https://api.example.com'),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { resolveApiBaseUrl } from '@/security';
import type { MapSourceV1 } from '@repo/public-contracts/v1/map';
import { DEMO_MAP_SOURCE } from '@/features/map/demoMapSource';
import { useExploreMapSource } from '../useExploreMapSource';
import type { MapSourceDeps } from '../map-source-client';

const livePayload: MapSourceV1 = {
  releaseId: 'rel_hook',
  features: [
    {
      type: 'Feature',
      id: 'ent_hook',
      geometry: { type: 'Point', coordinates: [-77.0, 38.9] },
      properties: {
        entityId: 'ent_hook',
        href: '/entity/ent_hook',
        kind: 'place',
        displayName: 'Hook Place',
        oneLineStory: 'From the API',
        precision: 'city',
        geoPrecisionTier: 'city',
        eraBuckets: [],
        notabilityLabels: [],
        evidenceCount: 0,
        confidenceTier: 'unrated',
        topicTags: [],
        shade: '#E09A55',
        glyph: 'circle',
      },
    },
  ],
};

function makeDeps(overrides: Partial<MapSourceDeps> = {}): MapSourceDeps {
  return {
    transport: {
      readJson: jest.fn(async () => ({ kind: 'ok' as const, data: livePayload })) as MapSourceDeps['transport']['readJson'],
    },
    releaseCache: {
      getActiveStamp: jest.fn(async () => 'rel_hook'),
      applyReleaseStamp: jest.fn(async () => 0),
      write: jest.fn(async () => undefined),
      verifyAndWriteArtifact: jest.fn(async () => undefined),
      read: jest.fn(async () => undefined),
    },
    connectivity: { isOnline: () => true },
    now: () => 1_700_000_000_000,
    ...overrides,
  };
}

describe('useExploreMapSource', () => {
  beforeEach(() => {
    jest.mocked(resolveApiBaseUrl).mockReturnValue('https://api.example.com');
  });

  it('resolves to live source when deps fetch succeeds', async () => {
    const deps = makeDeps();
    const { result } = await renderHook(() => useExploreMapSource({ deps }));

    await waitFor(() => expect(result.current.loadState.kind).toBe('ready'));
    expect(result.current.usingDemo).toBe(false);
    expect(result.current.source.features[0]?.properties.entityId).toBe('ent_hook');
    expect(result.current.releaseId).toBe('rel_hook');
  });

  it('forceDemo skips network and serves bundled fixtures', async () => {
    const readJson = jest.fn();
    const deps = makeDeps({ transport: { readJson } });
    const { result } = await renderHook(() => useExploreMapSource({ forceDemo: true, deps }));

    await waitFor(() => expect(result.current.loadState.kind).toBe('ready'));
    expect(result.current.usingDemo).toBe(true);
    expect(result.current.source).toBe(DEMO_MAP_SOURCE);
    expect(readJson).not.toHaveBeenCalled();
  });

  it('falls back to demo fixtures in __DEV__ when fetch fails', async () => {
    const deps = makeDeps({
      transport: {
        readJson: jest.fn(async () => {
          throw new Error('network down');
        }),
      },
      connectivity: { isOnline: () => true },
    });
    const { result } = await renderHook(() => useExploreMapSource({ deps }));

    await waitFor(() => expect(result.current.loadState.kind).toBe('ready'));
    expect(result.current.usingDemo).toBe(true);
    expect(result.current.source).toBe(DEMO_MAP_SOURCE);
  });

  it('does not fall back to demo when a local api-public URL is configured', async () => {
    jest.mocked(resolveApiBaseUrl).mockReturnValue('http://127.0.0.1:8080');
    const deps = makeDeps({
      transport: {
        readJson: jest.fn(async () => {
          throw new Error('network down');
        }),
      },
      connectivity: { isOnline: () => true },
    });
    const { result } = await renderHook(() => useExploreMapSource({ deps }));

    await waitFor(() => expect(result.current.loadState.kind).toBe('error'));
    expect(result.current.usingDemo).toBe(false);
    expect(result.current.source.features).toHaveLength(0);
  });

  it('retry re-fetches after an error path settles to demo in __DEV__', async () => {
    const readJson = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ kind: 'ok', data: livePayload });
    const deps = makeDeps({ transport: { readJson } });
    const { result } = await renderHook(() => useExploreMapSource({ deps }));

    await waitFor(() => expect(result.current.usingDemo).toBe(true));

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.usingDemo).toBe(false));
    expect(result.current.source.features[0]?.properties.entityId).toBe('ent_hook');
    expect(readJson).toHaveBeenCalledTimes(2);
  });

  it('stays loading until deps are injected', async () => {
    const { result } = await renderHook(() => useExploreMapSource());
    expect(result.current.loadState.kind).toBe('loading');
    expect(result.current.usingDemo).toBe(false);
  });
});
