/**
 * Live Explore map source client (ADR-025 / ADR-022).
 *
 * Fetches release-coupled `MapSourceV1` from `GET /v1/map` through the shared
 * transport stack (same attestation + ETag path as search/entity). Projects the
 * richer V1 feature properties onto the local `MapFeatureCollection` shape the
 * MapLibre layer already renders — never invents coordinates.
 */
import { mapSourceV1Schema, type MapSourceV1 } from '@repo/public-contracts/v1/map';
import { TransportError, type ReleaseCache } from '@/data';
import type { MapFeatureCollection, MapPointFeature } from '@/features/map/demoMapSource';

export const MAP_PATH = '/v1/map';
export const MAP_NAMESPACE = 'map' as const;
export const MAP_CACHE_KEY = 'source' as const;

export type MapSourceDeps = {
  readonly transport: {
    readJson<T>(path: string): Promise<{ kind: 'ok'; data: T } | { kind: 'not-modified' }>;
  };
  readonly releaseCache: ReleaseCache;
  readonly connectivity: { isOnline(): boolean };
  readonly now?: () => number;
};

export type MapSourceFetchResult =
  | {
      readonly status: 'ready';
      readonly source: MapFeatureCollection;
      readonly releaseId: string;
      readonly fromCache: boolean;
      readonly degraded: boolean;
    }
  | { readonly status: 'offline-no-cache' }
  | { readonly status: 'error'; readonly message: string };

/** Projects MapSourceV1 features onto the MapLibre FeatureCollection used by MapScreen. */
export function mapSourceV1ToFeatureCollection(source: MapSourceV1): MapFeatureCollection {
  const features: MapPointFeature[] = source.features.map((feature) => ({
    type: 'Feature',
    id: feature.id,
    geometry: {
      type: 'Point',
      coordinates: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
    },
    properties: {
      entityId: feature.properties.entityId,
      kind: feature.properties.kind,
      displayName: feature.properties.displayName,
      precision: feature.properties.precision,
      ...(feature.properties.stateFips ? { stateFips: feature.properties.stateFips } : {}),
      ...(feature.properties.statePostalCode
        ? { statePostalCode: feature.properties.statePostalCode }
        : {}),
      ...(feature.properties.stateName ? { stateName: feature.properties.stateName } : {}),
      ...(feature.properties.eraBuckets.length > 0
        ? { eraBuckets: feature.properties.eraBuckets }
        : {}),
      ...(feature.properties.oneLineStory
        ? { oneLineStory: feature.properties.oneLineStory }
        : {}),
    },
  }));
  return { type: 'FeatureCollection', features };
}

function parseMapSource(raw: unknown): MapSourceV1 | undefined {
  const parsed = mapSourceV1Schema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Network-first map source fetch with release-cache fallback (same posture as entity detail).
 */
export async function fetchMapSource(deps: MapSourceDeps): Promise<MapSourceFetchResult> {
  const now = deps.now ?? Date.now;
  const isOnline = deps.connectivity.isOnline();

  const readCache = async (
    degraded: boolean,
  ): Promise<MapSourceFetchResult | undefined> => {
    const activeStamp = (await deps.releaseCache.getActiveStamp()) ?? '';
    const cached = await deps.releaseCache.read<unknown>(MAP_NAMESPACE, MAP_CACHE_KEY, {
      activeStamp,
      degraded,
      now: now(),
    });
    if (!cached) return undefined;
    const parsed = parseMapSource(cached.value);
    if (!parsed) return undefined;
    return {
      status: 'ready',
      source: mapSourceV1ToFeatureCollection(parsed),
      releaseId: parsed.releaseId,
      fromCache: true,
      degraded,
    };
  };

  if (!isOnline) {
    return (await readCache(true)) ?? { status: 'offline-no-cache' };
  }

  try {
    const response = await deps.transport.readJson<unknown>(MAP_PATH);
    if (response.kind === 'not-modified') {
      return (
        (await readCache(false)) ?? {
          status: 'error',
          message: 'Map source not modified but cache miss',
        }
      );
    }
    const parsed = parseMapSource(response.data);
    if (!parsed) {
      return (
        (await readCache(true)) ?? {
          status: 'error',
          message: 'Map source failed contract validation',
        }
      );
    }

    const stamp = parsed.releaseId;
    try {
      await deps.releaseCache.applyReleaseStamp(stamp, now());
      await deps.releaseCache.write(MAP_NAMESPACE, MAP_CACHE_KEY, parsed, {
        releaseStamp: stamp,
        fetchedAt: now(),
      });
    } catch {
      // Caching is a convenience tier — never block a successful live render.
    }

    return {
      status: 'ready',
      source: mapSourceV1ToFeatureCollection(parsed),
      releaseId: parsed.releaseId,
      fromCache: false,
      degraded: false,
    };
  } catch (err) {
    const cached = await readCache(true);
    if (cached) return cached;
    if (err instanceof TransportError && err.info.kind === 'network') {
      return { status: 'offline-no-cache' };
    }
    const message = err instanceof Error ? err.message : 'Map source request failed';
    return { status: 'error', message };
  }
}
