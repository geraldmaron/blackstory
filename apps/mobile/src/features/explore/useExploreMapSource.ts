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
import { useAppRuntimeOptional } from '@/runtime';
import { DEMO_MAP_SOURCE, type MapFeatureCollection, type MapLoadState } from '@/features/map';
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
  return typeof __DEV__ !== 'undefined' && __DEV__;
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
  const forceDemo = options.forceDemo === true;
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<ExploreMapSourceState>(() =>
    forceDemo
      ? {
          source: DEMO_MAP_SOURCE,
          loadState: { kind: 'ready' },
          usingDemo: true,
          retry: () => undefined,
        }
      : {
          source: emptySource(),
          loadState: { kind: 'loading' },
          usingDemo: false,
          retry: () => undefined,
        },
  );

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

  useEffect(() => {
    if (forceDemo) {
      setState({
        source: DEMO_MAP_SOURCE,
        loadState: { kind: 'ready' },
        usingDemo: true,
        retry,
      });
      return;
    }

    if (!deps) {
      setState({
        source: emptySource(),
        loadState: { kind: 'loading' },
        usingDemo: false,
        retry,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({
      ...prev,
      loadState: prev.loadState.kind === 'ready' ? prev.loadState : { kind: 'loading' },
      retry,
    }));

    void (async () => {
      const result = await fetchMapSource(deps);
      if (cancelled) return;
      setState(toViewState(result, retry));
    })();

    return () => {
      cancelled = true;
    };
  }, [deps, forceDemo, retry, tick]);

  // If runtime never arrives and we're past warm-up, allow demo fallback in __DEV__.
  useEffect(() => {
    if (forceDemo || deps) return;
    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev.loadState.kind !== 'loading') return prev;
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
  }, [deps, forceDemo, retry]);

  return state;
}
