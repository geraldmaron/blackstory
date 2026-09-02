/**
 * Cached Door pin plate and opaque redirect table.
 *
 * `/` and `/door/pin/*` share redirect resolution without reloading the full catalog on every
 * pin click. The full pin GeoJSON (~2.3MB live) exceeds Next's 2MB data-cache limit, so only
 * the compact redirect table rides `unstable_cache`; the plate stays in process memory (same
 * gate pattern as `live-catalog-cache.ts`).
 */
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { listPublicEntities } from '../../data/public-seed';
import type { PublicReadSource } from '../public-data/source';
import {
  createLiveCatalogMemoryCache,
  createSingleFlight,
  estimateJsonCacheBytes,
  fitsNextDataCache,
} from '../public-data/live-catalog-cache';
import {
  exploreMapSourceFor,
  type ExploreMapFeature,
  type ExploreMapFeatureCollection,
} from './build-explore-map-source';
import {
  firstPaintPinId,
  parseFirstPaintPinId,
  resolveDoorPinTarget,
  toDoorLinkPins,
} from './first-paint-pins';
import { buildStateDensityLevels, type StateDensityLevel } from './density';
import { getSharedPublicEntities } from './shared-map-data';

/** Aligned with `RELEASE_CATALOG_REVALIDATE_SECONDS` in `../public-data/source.ts`. */
export const DOOR_CATALOG_REVALIDATE_SECONDS = 1_800;

/** Pin redirects are stable for the active release; cache aggressively at the edge. */
export const DOOR_PIN_REDIRECT_CACHE_CONTROL =
  'public, s-maxage=3600, stale-while-revalidate=86400';

export type DoorRedirectTableCache = {
  readonly pinRedirects: readonly string[];
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly source: PublicReadSource | 'none';
};

export type DoorPinPlateCache = DoorRedirectTableCache & {
  readonly pins: ExploreMapFeatureCollection;
  readonly features: readonly ExploreMapFeature[];
  /** Per-state presence tiers for the live plate — the same tint the Atlas opens on. */
  readonly densityLevels: readonly StateDensityLevel[];
};

const doorPlateMemory = createLiveCatalogMemoryCache<DoorPinPlateCache>({
  defaultTtlMs: DOOR_CATALOG_REVALIDATE_SECONDS * 1000,
  maxEntries: 4,
});

const doorCatalogSingleFlight = createSingleFlight();

function doorPlateMemoryKey(releaseId: string, generatedAt: string): string {
  return `door-pin-plate:${releaseId}:${generatedAt}`;
}

async function loadDoorCatalogEntities(): Promise<{
  readonly data: ReturnType<typeof listPublicEntities>;
  readonly source: PublicReadSource | 'none';
}> {
  try {
    return await getSharedPublicEntities();
  } catch {
    return { data: listPublicEntities(), source: 'none' };
  }
}

function buildDoorPinPlateCache(
  entities: ReturnType<typeof listPublicEntities>,
  source: PublicReadSource | 'none',
): DoorPinPlateCache {
  const mapSource = exploreMapSourceFor(entities);
  const features = mapSource.featureCollection.features;
  const pins = toDoorLinkPins(features);
  const pinRedirects = features.map((_feature, index) => {
    const pinId = firstPaintPinId(index);
    return resolveDoorPinTarget(pinId, features) ?? '';
  });
  return {
    pins,
    pinRedirects,
    features,
    densityLevels: buildStateDensityLevels(mapSource.stateAggregates),
    releaseId: mapSource.releaseId,
    generatedAt: mapSource.generatedAt,
    source,
  };
}

function buildRedirectTableOnly(plate: DoorPinPlateCache): DoorRedirectTableCache {
  return {
    pinRedirects: plate.pinRedirects,
    releaseId: plate.releaseId,
    generatedAt: plate.generatedAt,
    source: plate.source,
  };
}

async function loadDoorPinPlateFromEntities(): Promise<DoorPinPlateCache> {
  const { data: entities, source } = await loadDoorCatalogEntities();
  const built = buildDoorPinPlateCache(entities, source);
  doorPlateMemory.set(
    doorPlateMemoryKey(built.releaseId, built.generatedAt),
    built,
    undefined,
    DOOR_CATALOG_REVALIDATE_SECONDS * 1000,
  );
  return built;
}

async function fetchDoorRedirectTableFromNext(): Promise<DoorRedirectTableCache> {
  return unstable_cache(
    async () => {
      const plate = await doorCatalogSingleFlight('door-pin-plate-build', () =>
        loadDoorPinPlateFromEntities(),
      );
      const redirectTable = buildRedirectTableOnly(plate);
      if (!fitsNextDataCache(estimateJsonCacheBytes(redirectTable))) {
        throw new Error('Door redirect table exceeded Next data-cache safe size');
      }
      return redirectTable;
    },
    ['door-pin-redirects-v2'],
    { revalidate: DOOR_CATALOG_REVALIDATE_SECONDS },
  )();
}

async function fetchDoorPinPlateCache(): Promise<DoorPinPlateCache> {
  const redirectTable = await fetchDoorRedirectTableFromNext();
  const memHit = doorPlateMemory.get(
    doorPlateMemoryKey(redirectTable.releaseId, redirectTable.generatedAt),
  );
  if (memHit !== undefined) {
    return memHit;
  }
  return doorCatalogSingleFlight('door-pin-plate-build', () => loadDoorPinPlateFromEntities());
}

/** Cross-request cached pin plate + redirect table (shared by `/` and `/door/pin/*`). */
export const loadDoorPinPlate = cache(fetchDoorPinPlateCache);

/** Resolve an opaque `/door/pin/pin-N` id without rebuilding the feature collection. */
export async function resolveDoorPinRedirect(pinId: string): Promise<string | null> {
  const index = parseFirstPaintPinId(decodeURIComponent(pinId));
  if (index === null) return null;
  const { pinRedirects } = await fetchDoorRedirectTableFromNext();
  const href = pinRedirects[index];
  return href !== undefined && href.length > 0 ? href : null;
}

/** Test hook: build redirect table from seed entities and report Next cache fit. */
export function doorRedirectTableCacheShapeForTest(
  entities: ReturnType<typeof listPublicEntities>,
  source: PublicReadSource | 'none' = 'none',
): { readonly table: DoorRedirectTableCache; readonly bytes: number; readonly fitsNext: boolean } {
  const table = buildRedirectTableOnly(buildDoorPinPlateCache(entities, source));
  const bytes = estimateJsonCacheBytes(table);
  return { table, bytes, fitsNext: fitsNextDataCache(bytes) };
}
