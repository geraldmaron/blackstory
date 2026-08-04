import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { MapColorScheme } from '../../lib/map-experience/dignity-style';
import type { StateDensityLevel } from '../../lib/map-experience/density';
import type { StateChoroplethLevel } from '../../lib/map-experience/state-choropleth';
import type { CountyChoroplethLevel } from '../../lib/map-experience/county-choropleth';
import { joinDensityOntoStatePolygons } from '../../lib/map-experience/join-state-polygons';
import { joinPopulationOntoCountyPolygons } from '../../lib/map-experience/join-county-population';
import { joinPopulationOntoStatePolygons } from '../../lib/map-experience/join-state-population';
import { US_STATES_GEOJSON_PATH } from '../../lib/map-experience/us-state-polygons';
import {
  COUNTY_LINES_PREFETCH_ZOOM,
  US_COUNTIES_GEOJSON_PATH,
} from '../../lib/map-experience/us-county-lines';
import { DEFAULT_POPULATION_GEO } from '../../lib/map-experience/explore-population';
import {
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_COUNTY_LINES_SOURCE_ID,
} from '../../app/map/explore-layer-ids';
import { readDocumentColorScheme } from './color-scheme';
import type { StageConfig } from './stage-config';

export type StatePolygonCollection = {
  type: 'FeatureCollection';
  features: { type: string; id?: string; properties: Record<string, unknown>; geometry: unknown }[];
};

let statePolygonsPromise: Promise<StatePolygonCollection> | undefined;

export function fetchStatePolygons(): Promise<StatePolygonCollection> {
  if (!statePolygonsPromise) {
    statePolygonsPromise = fetch(US_STATES_GEOJSON_PATH).then(async (response) => {
      if (!response.ok) {
        statePolygonsPromise = undefined;
        throw new Error(`Failed to load ${US_STATES_GEOJSON_PATH}: ${response.status}`);
      }
      return (await response.json()) as StatePolygonCollection;
    });
  }
  return statePolygonsPromise;
}
export async function loadStatePolygonsWithDensity(
  map: MapLibreMap,
  densityLevels: readonly StateDensityLevel[],
  stateChoroplethLevels: readonly StateChoroplethLevel[] = [],
  sourceId: string = EXPLORE_STATE_DENSITY_SOURCE_ID,
  colorScheme: MapColorScheme = readDocumentColorScheme(),
): Promise<ReturnType<typeof joinDensityOntoStatePolygons>> {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (!source) {
    return { type: 'FeatureCollection', features: [] };
  }
  const collection = await fetchStatePolygons();
  const joined =
    stateChoroplethLevels.length > 0
      ? joinPopulationOntoStatePolygons(collection, stateChoroplethLevels)
      : joinDensityOntoStatePolygons(collection, densityLevels, { colorScheme });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
  source.setData(joined as any);
  await waitForGeoJsonSourceData(map, sourceId);
  return joined;
}
/**
 * Resolves after MapLibre finishes applying a GeoJSON `setData` for `sourceId`
 * (sourcedata + isSourceLoaded), or after a short timeout. Promote must not lift
 * the incoming cover until the primary density source holds the new frame.
 */
export function waitForGeoJsonSourceData(
  map: MapLibreMap,
  sourceId: string,
  timeoutMs = 500,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      map.off('sourcedata', onSourceData);
      window.clearTimeout(timer);
      resolve();
    };
    const onSourceData = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (event.sourceId === sourceId && event.isSourceLoaded) finish();
    };
    map.on('sourcedata', onSourceData);
    const timer = window.setTimeout(finish, timeoutMs);
  });
}
export type CountyPolygonCollection = {
  type: 'FeatureCollection';
  features: { type: string; id?: string; properties: Record<string, unknown>; geometry: unknown }[];
};

let countyLinesPromise: Promise<CountyPolygonCollection> | undefined;

export function fetchCountyPolygons(): Promise<CountyPolygonCollection> {
  if (!countyLinesPromise) {
    countyLinesPromise = fetch(US_COUNTIES_GEOJSON_PATH)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${US_COUNTIES_GEOJSON_PATH}: ${response.status}`);
        }
        return (await response.json()) as CountyPolygonCollection;
      })
      .catch((error) => {
        // Clear the cached promise so a later blackShare/zoom retry can recover.
        countyLinesPromise = undefined;
        throw error;
      });
  }
  return countyLinesPromise;
}
/** Maps whose county source already holds the real geometry — `zoomend` keeps firing past the
 * prefetch threshold, and re-`setData`ing 3k polygons on every camera settle would churn the
 * GeoJSON worker for nothing. */
const countyLinesLoaded = new WeakSet<MapLibreMap>();
/** Per-map generation so a stale empty-levels fetch cannot overwrite a later choropleth join. */
const countyLinesLoadGeneration = new WeakMap<MapLibreMap, number>();
/** Once a choropleth join is requested, ignore empty-level loads (even mid-flight). */
const countyChoroplethJoinRequested = new WeakSet<MapLibreMap>();

/** Lazily fills the county source (hairlines + optional choropleth). Deliberately zoom-triggered
 * by the caller, not eager: the ~2.3 MB asset is invisible below the layer's `minzoom`, so the
 * national resting frame never pays for it — except population choropleths, which load at any
 * zoom when `blackShare` / `blackChange` is active.
 *
 * Empty-level calls after geometry is present — or after a join was requested — are no-ops so
 * fade-path / StrictMode patches with `[]` cannot wipe `shareTier`. */
export async function loadCountyPolygons(
  map: MapLibreMap,
  choroplethLevels: readonly CountyChoroplethLevel[],
): Promise<void> {
  const source = map.getSource(EXPLORE_COUNTY_LINES_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  if (choroplethLevels.length > 0) {
    countyChoroplethJoinRequested.add(map);
  } else if (countyLinesLoaded.has(map) || countyChoroplethJoinRequested.has(map)) {
    return;
  }
  const generation = (countyLinesLoadGeneration.get(map) ?? 0) + 1;
  countyLinesLoadGeneration.set(map, generation);
  const collection = await fetchCountyPolygons();
  if (countyLinesLoadGeneration.get(map) !== generation) {
    // A newer load (usually with choropleth tiers) superseded this one mid-flight.
    return;
  }
  const joined =
    choroplethLevels.length > 0
      ? joinPopulationOntoCountyPolygons(collection, choroplethLevels)
      : collection;
  countyLinesLoaded.add(map);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
  source.setData(joined as any);
}
/** County geometry + population join still need to land during decade-morph `configOnly`
 * patches — those skip `applyStyleAndData`, which previously left blackShare without tiers. */
export function requestCountyPolygonLoad(map: MapLibreMap, cfg: StageConfig): void {
  const popGeo = cfg.popGeo ?? DEFAULT_POPULATION_GEO;
  const needsCountyGeometry =
    map.getZoom() >= COUNTY_LINES_PREFETCH_ZOOM ||
    ((cfg.layerMode === 'blackShare' || cfg.layerMode === 'blackChange') && popGeo === 'county');
  if (!needsCountyGeometry) return;
  void loadCountyPolygons(map, cfg.countyChoroplethLevels).catch((error) => {
    console.error('[MapStage] county polygon load failed', error);
  });
}
