/**
 * Loads the live Explore map FeatureCollection from `GET /v1/map`.
 *
 * Uses an effect + explicit deps (same posture as entity detail) rather than
 * TanStack Query, so Explore still mounts when AppProviders is still warming
 * and no QueryClientProvider is present yet.
 *
 * Falls back to bundled DEMO_MAP_SOURCE only in `__DEV__` after a failed or
 * unavailable live fetch, or when `forceDemo` is set (tests).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppRuntimeOptional, useRefreshBootstrapSync } from '@/runtime';
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from '@/security';
import { DEMO_MAP_SOURCE, type MapFeatureCollection } from '@/features/map/demoMapSource';
import type { MapLoadState } from '@/features/map/mapLoadState';
import {
  fetchMapSource,
  type MapSourceDeps,
  type MapSourceFetchResult,
} from './map-source-client';

export type ExploreMapSourceState = {
  readonly source: MapFeatureCollection;
  readonly loadState: MapLoadState;
  readonly usingDemo: boolean;
  readonly releaseId?: string;
  readonly retry: () => void;
};

export type UseExploreMapSourceOptions = {
  /** Force bundled fixtures (tests / explicit local flag). */
  readonly forceDemo?: boolean;
  /** Injected deps for unit tests. */
  readonly deps?: MapSourceDeps;
};

function allowDemoFallback(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  // When dev explicitly points at a local api-public, surface failures honestly
  // instead of silently substituting bundled fixtures.
  if (resolveApiBaseUrl() !== DEFAULT_API_BASE_URL) return false;
  return true;
}

function emptySource(): MapFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function toViewState(
  result: MapSourceFetchResult,
  retry: () => void,
): ExploreMapSourceState {
  if (result.status === 'ready') {
    return {
      source: result.source,
      loadState: { kind: 'ready' },
      usingDemo: false,
      releaseId: result.releaseId,
      retry,
    };
  }
  if (result.status === 'offline-no-cache') {
    if (allowDemoFallback()) {
      return {
        source: DEMO_MAP_SOURCE,
        loadState: { kind: 'ready' },
        usingDemo: true,
        retry,
      };
    }
    return {
      source: emptySource(),
      loadState: { kind: 'error', mode: 'offline-cold-start' },
      usingDemo: false,
      retry,
    };
  }
  if (allowDemoFallback()) {
    return {
      source: DEMO_MAP_SOURCE,
      loadState: { kind: 'ready' },
      usingDemo: true,
      retry,
    };
  }
  return {
    source: emptySource(),
    loadState: { kind: 'error', mode: 'provider-outage' },
    usingDemo: false,
    retry,
  };
}

export function useExploreMapSource(
  options: UseExploreMapSourceOptions = {},
): ExploreMapSourceState {
  const runtime = useAppRuntimeOptional();
  const refreshBootstrapSync = useRefreshBootstrapSync();
  const forceDemo = options.forceDemo === true;
  const [tick, setTick] = useState(0);

  const deps: MapSourceDeps | null = useMemo(() => {
    if (options.deps) return options.deps;
    if (!runtime) return null;
    return {
      transport: runtime.transport,
      releaseCache: runtime.releaseCache,
      connectivity: runtime.connectivity,
    };
  }, [options.deps, runtime]);

  const retry = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  const staticState = useMemo((): ExploreMapSourceState | null => {
    if (forceDemo) {
      return {
        source: DEMO_MAP_SOURCE,
        loadState: { kind: 'ready' },
        usingDemo: true,
        retry,
      };
    }
    if (!deps) {
      return {
        source: emptySource(),
        loadState: { kind: 'loading' },
        usingDemo: false,
        retry,
      };
    }
    return null;
  }, [forceDemo, deps, retry]);

  const [fetchedState, setFetchedState] = useState<ExploreMapSourceState | null>(null);

  useEffect(() => {
    if (staticState) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setFetchedState((prev) => ({
        source: prev?.source ?? emptySource(),
        loadState: prev?.loadState.kind === 'ready' ? prev.loadState : { kind: 'loading' },
        usingDemo: false,
        retry,
      }));

      const result = await fetchMapSource(deps!);
      if (cancelled) return;
      setFetchedState(toViewState(result, retry));
      if (result.status === 'ready' && !result.fromCache) {
        refreshBootstrapSync();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [staticState, deps, retry, tick, refreshBootstrapSync]);

  // If runtime never arrives and we're past warm-up, allow demo fallback in __DEV__.
  useEffect(() => {
    if (forceDemo || deps || staticState) return;
    const timer = setTimeout(() => {
      setFetchedState((prev) => {
        if (prev && prev.loadState.kind !== 'loading') return prev;
        if (allowDemoFallback()) {
          return {
            source: DEMO_MAP_SOURCE,
            loadState: { kind: 'ready' },
            usingDemo: true,
            retry,
          };
        }
        return {
          source: emptySource(),
          loadState: { kind: 'error', mode: 'provider-outage' },
          usingDemo: false,
          retry,
        };
      });
    }, 2_500);
    return () => clearTimeout(timer);
  }, [deps, forceDemo, retry, staticState]);

  return (
    staticState ??
    fetchedState ?? {
      source: emptySource(),
      loadState: { kind: 'loading' },
      usingDemo: false,
      retry,
    }
  );
}
