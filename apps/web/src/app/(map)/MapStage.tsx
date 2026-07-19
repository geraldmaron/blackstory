'use client';

/**
 * The persistent map canvas (ADR-017 "Persistent map canvas — one MapLibre instance
 * across hero and explore"). `MapStageProvider` mounts in the `(map)` route group's
 * `layout.tsx`, which React Router semantics never remount across `/` <-> `/explore`
 * navigations only the sibling `page.tsx`/`explore/page.tsx` trees swap. That means this
 * component's mount effect below runs exactly once per page load: the WebGL context, loaded
 * tiles, and camera all survive route changes by construction, not by choreography.
 *
 * Refactored from the former `apps/web/src/app/map/ExploreMapCanvas.tsx` (deleted — its
 * instance-lifecycle code lives here now). Every mutation helper below (`applyGeographyStyle`,
 * `setSelectedStateFilter`, `setHistoryEdgeData`, `syncCircularMarkers`, …) is a straight port;
 * what changed is the OUTER shape: instead of a props-driven component that a page mounts and
 * unmounts, this is a long-lived provider whose imperative API (`patchData` / `applyViewState` /
 * `flyPreset` / `subscribe`) pages call through `useMapStage()`. Dignity redaction flow, cluster
 * config, and `activateOnBackgroundClick`-equivalent semantics are all unchanged in substance —
 * see this module's exports' own doc comments for what moved where.
 *
 * `maplibre-gl` (and its CSS) are only ever dynamically imported here — the app's ONE such
 * import (ADR-017 consequence).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  GeoJSONSource,
  LayerSpecification,
  LngLatLike,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
  Marker,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import type * as MapLibreNamespace from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { brandPalette, darkTheme, lightTheme } from '@repo/ui';
import {
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_COUNTY_CHOROPLETH_LAYER_ID,
  EXPLORE_COUNTY_LABEL_LAYER_ID,
  EXPLORE_COUNTY_LINES_LAYER_ID,
  EXPLORE_COUNTY_LINES_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from '../map/explore-layer-ids';
import { buildExploreMapStyle } from '../map/explore-style';
import {
  DECADE_LAYER_FADE_MS,
  restoreDecadeFadePaintFromStyle,
  setDecadeFadeInLiterals,
  setDecadeFadeOpacities,
  setDecadeFadeTransitions,
} from '../map/decade-layer-transition';
import type { MapColorScheme } from '../../lib/map-experience/dignity-style';
import { EXPLORE_CLUSTER_CONFIG } from '../../lib/map-experience/dignity-style';
import type {
  ExploreMapFeatureCollection,
  JurisdictionAreaFeature,
} from '../../lib/map-experience/build-explore-map-source';
import {
  cameraPresetFor,
  prefersReducedMotion,
  type CameraPresetName,
} from '../../lib/map-experience/camera-presets';
import type { HistoryEdgeLineCollection } from '../../lib/map-experience/build-history-edge-lines';
import type { StateDensityLevel } from '../../lib/map-experience/density';
import type { CountyChoroplethLevel } from '../../lib/map-experience/county-choropleth';
import { joinDensityOntoStatePolygons } from '../../lib/map-experience/join-state-polygons';
import { joinPopulationOntoCountyPolygons } from '../../lib/map-experience/join-county-population';
import * as stateLabels from '../../lib/map-experience/state-labels';
import { US_STATES_GEOJSON_PATH } from '../../lib/map-experience/us-state-polygons';
import {
  COUNTY_LINES_PREFETCH_ZOOM,
  US_COUNTIES_GEOJSON_PATH,
} from '../../lib/map-experience/us-county-lines';
import type { ExploreLayerMode, ExploreViewportFrame } from '../../lib/map-experience/url-state';
import {
  PERSISTENT_PLATE_LAYER_IDS,
  syncLayerPaintFromStyle,
  syncSingleLayerPaint,
} from './map-plate-paint';

function readDocumentColorScheme(): MapColorScheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Theme-aware label colors; prefers `stateLabelColorsForScheme` from state-labels when exported. */
function stateLabelColorFor(scheme: MapColorScheme, selected: boolean): string {
  const colorsForScheme = (
    stateLabels as {
      stateLabelColorsForScheme?: (colorScheme: MapColorScheme) => {
        readonly muted: string;
        readonly selected: string;
      };
    }
  ).stateLabelColorsForScheme;
  if (colorsForScheme) {
    const colors = colorsForScheme(scheme);
    return selected ? colors.selected : colors.muted;
  }
  const theme = scheme === 'light' ? lightTheme : darkTheme;
  return selected ? brandPalette.copperDark : theme.inkMuted;
}

type MaplibreModule = typeof MapLibreNamespace;

const SELECTED_FILL_ID = 'explore-state-selected-fill';
const SELECTED_LINE_ID = 'explore-state-selected-line';

const EMPTY_EDGE_COLLECTION: HistoryEdgeLineCollection = {
  type: 'FeatureCollection',
  features: [],
};

const ARCHIVE_BASE_STYLE: StyleSpecification = {
  version: 8,
  name: 'BlackStory — Archive (US)',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      // Ocean plate — one step below Black Ink so the warm landmass fills lift
      // off it (must match DIGNITY_PALETTE.ocean; this literal exists only to
      // keep the pre-style-load frame from flashing a different shade).
      paint: { 'background-color': '#080606' },
    },
  ],
};

const GEOGRAPHY_LAYER_IDS = new Set([
  'background',
  'explore-street-casing',
  'explore-street-fill',
  'explore-street-label',
  'explore-state-density-fill',
  EXPLORE_COUNTY_CHOROPLETH_LAYER_ID,
  EXPLORE_COUNTY_LINES_LAYER_ID,
  EXPLORE_COUNTY_LABEL_LAYER_ID,
  'explore-state-bounds-line',
  'explore-state-selected-fill',
  'explore-state-selected-line',
  'explore-jurisdiction-area-fill',
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
]);

/** The entity-marker stack from `buildExploreMapStyle`, in its stacking order: halo beneath
 * point beneath the event glyph ring, clusters above singles, selected ring on top. Added once
 * then paint-refreshed on style rebuild (theme plate stroke, kind shade expressions). */
const ENTITY_LAYER_IDS = new Set([
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
]);

/** Sources whose real geometry arrives from a lazy client fetch (`loadStatePolygonsWithDensity`,
 * `loadCountyLines`) — their inline style data is an empty placeholder, so a data patch must
 * never `setData` it back over the loaded polygons. */
const LAZY_GEOGRAPHY_SOURCE_IDS = new Set<string>([
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_COUNTY_LINES_SOURCE_ID,
]);

/** Normalizes `maplibre-gl`'s `LngLatLike` union (a `LngLat` instance, a `{lng,lat}` or
 * `{lon,lat}` object literal, or a `[lng, lat]` tuple) to a plain tuple. `cameraForBounds`
 * types its result this loosely even though the runtime value is always a `LngLat` instance. */
function lngLatTuple(value: LngLatLike): [number, number] {
  if (Array.isArray(value)) return [value[0], value[1]];
  if ('lng' in value) return [value.lng, value.lat];
  return [value.lon, value.lat];
}

function readViewport(map: MapLibreMap): ExploreViewportFrame {
  const center = map.getCenter();
  const bounds = map.getBounds();
  return {
    lat: center.lat,
    lng: center.lng,
    zoom: map.getZoom(),
    bounds: {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    },
  };
}

function clearMarkers(markers: Marker[]): void {
  for (const marker of markers) marker.remove();
  markers.length = 0;
}

function syncCircularMarkers(
  map: MapLibreMap,
  maplibregl: MaplibreModule['default'],
  features: ExploreMapFeatureCollection['features'],
  markers: Marker[],
  onSelect: (entityId: string) => void,
): void {
  clearMarkers(markers);

  // Below clusterMaxZoom, MapLibre aggregates points — HTML hit-targets for every feature
  // sit above clusters and steal clicks. Only mount DOM targets once individuals are visible.
  if (map.getZoom() <= EXPLORE_CLUSTER_CONFIG.clusterMaxZoom) {
    return;
  }

  for (const feature of features) {
    if (feature.geometry.type !== 'Point') continue;
    const [lng, lat] = feature.geometry.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    const entityId = feature.properties.entityId;
    if (typeof entityId !== 'string') continue;

    const label =
      typeof feature.properties.displayName === 'string'
        ? feature.properties.displayName
        : 'Documented record';

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ds-map-entity-marker';
    el.setAttribute('aria-label', label);
    el.title = label;
    // Mirror the GL circle kind shade so the hit-target disc matches KindBadge / explore-point
    // (transparent overlays previously left only the sand halo readable as "the" circle color).
    const shade =
      typeof feature.properties.shade === 'string' && feature.properties.shade.length > 0
        ? feature.properties.shade
        : brandPalette.copperPin;
    el.style.setProperty('--ds-map-entity-shade', shade);
    el.dataset.kind = feature.properties.kind;
    if (typeof feature.properties.mapTone === 'string') {
      el.dataset.mapTone = feature.properties.mapTone;
    }
    // The map canvas is `aria-hidden` (see `MapStageProvider`'s render) — the synchronized
    // result list is the accessible-parity surface for the same entities, so these buttons
    // are deliberately pulled out of the tab order rather than left focusable-but-hidden
    // (a WAI-ARIA anti-pattern).
    el.tabIndex = -1;
    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(entityId);
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map);
    markers.push(marker);
  }
}

function setSelectedEntityFilter(map: MapLibreMap, entityId: string | undefined): void {
  if (!map.getLayer(EXPLORE_SELECTED_POINT_LAYER_ID)) return;
  const filter =
    entityId && entityId.length > 0
      ? (['==', ['get', 'entityId'], entityId] as unknown as [string, ...unknown[]])
      : (['==', ['get', 'entityId'], ''] as unknown as [string, ...unknown[]]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FilterSpecification ambient typing unavailable
  map.setFilter(EXPLORE_SELECTED_POINT_LAYER_ID, filter as any);
}

function setHistoryEdgeData(map: MapLibreMap, collection: HistoryEdgeLineCollection): void {
  const source = map.getSource(EXPLORE_HISTORY_EDGES_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
  source.setData(collection as any);
}

function setSelectedEdgeFilter(map: MapLibreMap, edgeId: string | undefined): void {
  const filter =
    edgeId && edgeId.length > 0
      ? (['==', ['get', 'edgeId'], edgeId] as unknown as [string, ...unknown[]])
      : (['==', ['get', 'edgeId'], ''] as unknown as [string, ...unknown[]]);
  if (map.getLayer(EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FilterSpecification ambient typing unavailable
    map.setFilter(EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID, filter as any);
  }
}

function setHistoryEdgesVisibility(map: MapLibreMap, enabled: boolean): void {
  const visibility = enabled ? 'visible' : 'none';
  for (const id of [EXPLORE_HISTORY_EDGES_LAYER_ID, EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visibility);
    }
  }
}

type StatePolygonCollection = {
  type: 'FeatureCollection';
  features: { type: string; id?: string; properties: Record<string, unknown>; geometry: unknown }[];
};

let statePolygonsPromise: Promise<StatePolygonCollection> | undefined;

function fetchStatePolygons(): Promise<StatePolygonCollection> {
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

async function loadStatePolygonsWithDensity(
  map: MapLibreMap,
  densityLevels: readonly StateDensityLevel[],
): Promise<void> {
  const source = map.getSource(EXPLORE_STATE_DENSITY_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  const collection = await fetchStatePolygons();
  const joined = joinDensityOntoStatePolygons(collection, densityLevels);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
  source.setData(joined as any);
}

type CountyPolygonCollection = {
  type: 'FeatureCollection';
  features: { type: string; id?: string; properties: Record<string, unknown>; geometry: unknown }[];
};

let countyLinesPromise: Promise<CountyPolygonCollection> | undefined;

function fetchCountyPolygons(): Promise<CountyPolygonCollection> {
  if (!countyLinesPromise) {
    countyLinesPromise = fetch(US_COUNTIES_GEOJSON_PATH).then(async (response) => {
      if (!response.ok) {
        countyLinesPromise = undefined;
        throw new Error(`Failed to load ${US_COUNTIES_GEOJSON_PATH}: ${response.status}`);
      }
      return (await response.json()) as CountyPolygonCollection;
    });
  }
  return countyLinesPromise;
}

/** Maps whose county source already holds the real geometry — `zoomend` keeps firing past the
 * prefetch threshold, and re-`setData`ing 3k polygons on every camera settle would churn the
 * GeoJSON worker for nothing. */
const countyLinesLoaded = new WeakSet<MapLibreMap>();

/** Lazily fills the county source (hairlines + optional choropleth). Deliberately zoom-triggered
 * by the caller, not eager: the ~2.3 MB asset is invisible below the layer's `minzoom`, so the
 * national resting frame never pays for it. */
async function loadCountyPolygons(
  map: MapLibreMap,
  choroplethLevels: readonly CountyChoroplethLevel[],
): Promise<void> {
  const source = map.getSource(EXPLORE_COUNTY_LINES_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  const collection = await fetchCountyPolygons();
  const joined =
    choroplethLevels.length > 0
      ? joinPopulationOntoCountyPolygons(collection, choroplethLevels)
      : collection;
  if (countyLinesLoaded.has(map)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
    source.setData(joined as any);
    return;
  }
  countyLinesLoaded.add(map);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
  source.setData(joined as any);
}

function applyGeographyStyle(
  map: MapLibreMap,
  style: StyleSpecification,
  options?: { readonly recreateEntitiesSource?: boolean },
): void {
  const recreateEntities = options?.recreateEntitiesSource === true;

  if (recreateEntities) {
    // Clustering is baked into the GeoJSON source at add time — toggling it requires a
    // deliberate remove/re-add of the entities source + its layers. Do this only on an
    // explicit grouping flip (not on every data patch), and tear layers down first.
    for (const layerId of ENTITY_LAYER_IDS) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    if (map.getSource(EXPLORE_ENTITIES_SOURCE_ID)) {
      map.removeSource(EXPLORE_ENTITIES_SOURCE_ID);
    }
  }

  for (const [id, source] of Object.entries(style.sources ?? {})) {
    const existing = map.getSource(id) as GeoJSONSource | undefined;
    if (existing) {
      // Update in place — NEVER removeSource/addSource on a routine data patch. Re-adding a
      // source id while the worker is still tearing the old one down corrupts the internal
      // GeoJSON tile pyramid (only the tile in flight at teardown ever renders again), and
      // patches land in quick succession on mount (hero reset + explore sync, doubled by
      // StrictMode). Lazy geography sources (states+density, county lines) are skipped: their
      // inline style data is an empty placeholder that their own loaders overwrite —
      // setData'ing the placeholder first would just blank-flash the loaded polygons. The
      // entities source DOES setData here: that is how a surface's filter changes reach the
      // GL circle layers.
      if (LAZY_GEOGRAPHY_SOURCE_IDS.has(id)) continue;
      const data = (source as { data?: unknown }).data;
      if (typeof existing.setData === 'function' && data && typeof data === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        existing.setData(data as any);
      }
      continue;
    }
    map.addSource(id, source as SourceSpecification);
  }
  // Geography layers slot in BENEATH the entity-marker stack whenever it already exists (they
  // are removed and re-added on every apply for mode-dependent paint; the entity layers are
  // not, so without an anchor each re-add would climb above the markers and bury them under
  // state fills). Entity layers append once, in the style array's own stacking order.
  const entityAnchor = map.getLayer(EXPLORE_UNCLUSTERED_HALO_LAYER_ID)
    ? EXPLORE_UNCLUSTERED_HALO_LAYER_ID
    : undefined;
  for (const layer of style.layers ?? []) {
    if (GEOGRAPHY_LAYER_IDS.has(layer.id)) {
      if (!map.getLayer(layer.id)) {
        const beforeId = layer.id === 'background' ? undefined : entityAnchor;
        map.addLayer(layer as LayerSpecification, beforeId);
      } else {
        syncSingleLayerPaint(map, layer);
      }
      continue;
    }
    if (ENTITY_LAYER_IDS.has(layer.id)) {
      if (!map.getLayer(layer.id)) {
        map.addLayer(layer as LayerSpecification);
      } else if (layer.type === 'circle' && 'paint' in layer && layer.paint) {
        // Refresh kind-shade / plate-dependent paint when the style rebuilds (theme toggle,
        // encoding updates). Source geometry still updates via setData above.
        for (const [paintKey, paintValue] of Object.entries(layer.paint)) {
          try {
            map.setPaintProperty(layer.id, paintKey, paintValue);
          } catch (error) {
            console.error(`[MapStage] setPaintProperty ${layer.id}.${paintKey} failed`, error);
          }
        }
      }
    }
  }
}

function setSelectedStateFilter(map: MapLibreMap, postalCode: string | undefined): void {
  const filter =
    postalCode && postalCode.length > 0
      ? (['==', ['get', 'postalCode'], postalCode] as unknown as [string, ...unknown[]])
      : (['==', ['get', 'postalCode'], ''] as unknown as [string, ...unknown[]]);
  if (map.getLayer(SELECTED_FILL_ID)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FilterSpecification ambient typing unavailable
    map.setFilter(SELECTED_FILL_ID, filter as any);
  }
  if (map.getLayer(SELECTED_LINE_ID)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FilterSpecification ambient typing unavailable
    map.setFilter(SELECTED_LINE_ID, filter as any);
  }
}

// ---------------------------------------------------------------------------------------------
// Public stage API
// ---------------------------------------------------------------------------------------------

/** Source-data + mode flags a surface (home hero, explore) hands the stage. The stage rebuilds
 * its MapLibre style from this every call (via `buildExploreMapStyle`, 's style builder —
 * consumed here, never modified) and reapplies geography layers + resyncs entity markers. Always
 * the FULL current shape, not a delta — mirrors how `ExploreMapCanvas` used to receive these as
 * plain re-render props. */
export type MapStageDataPatch = {
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly layerMode: ExploreLayerMode;
  readonly densityLevels: readonly StateDensityLevel[];
  readonly countyChoroplethLevels?: readonly CountyChoroplethLevel[];
  /** When false, recreate the entities source without MapLibre clustering. Omitted patches keep the current stage value (default false). */
  readonly clusteringEnabled?: boolean;
  readonly historyEdgesEnabled: boolean;
  readonly historyEdgeCollection: HistoryEdgeLineCollection;
};

/** Selection-only view state: cheap filter/paint updates, no style rebuild. `undefined` clears
 * the corresponding selection (always pass both — this is the current full selection, not a
 * delta, same convention as `MapStageDataPatch`). */
export type MapStageViewPatch = {
  readonly selectedState: string | undefined;
  readonly selectedEdge: string | undefined;
  /** Copper orientation ring on the map for a focused record (e.g. return from entity page). */
  readonly selectedEntity?: string | undefined;
};

export type CameraFlyTarget =
  | { readonly center: readonly [lng: number, lat: number]; readonly zoom: number }
  | { readonly bounds: readonly [west: number, south: number, east: number, north: number] };

export type MapStageFlyOptions = {
  /** `'fly'` (default): cinematic arc, used for hero-engagement descents. `'ease'`: linear
   * pan/zoom with the same authored duration/easing but no arc — used to reconcile the camera
   * against a URL viewport (deep link, back/forward), where a swooping arc would read as an
   * unrequested flight rather than a restored view. */
  readonly mode?: 'fly' | 'ease';
  /** Override uniform preset padding — e.g. clear the right results rail for a selected point. */
  readonly padding?:
    | number
    | {
        readonly top: number;
        readonly bottom: number;
        readonly left: number;
        readonly right: number;
      };
};

type MapStageEvents = {
  select: [entityId: string];
  stateSelect: [postalCode: string];
  edgeSelect: [edgeId: string];
  /** Fired on a background click when nothing else (state, edge) was hit — the
   * `activateOnBackgroundClick` behavior `HomeMapHero` used to opt into via a prop. Now every
   * surface gets the event; only the ones that `subscribe('activate', …)` act on it, which is an
   * equivalent opt-in. */
  activate: [viewport: ExploreViewportFrame];
  viewport: [viewport: ExploreViewportFrame];
  error: [];
};

type MapStageEventName = keyof MapStageEvents;

/** Optional behavior for `patchData`. `fade` runs an opacity out→swap→in on decade-relevant
 * layers (pins, presence fill, relationship lines) when motion is allowed. */
export type MapStageDataPatchOptions = {
  readonly fade?: boolean;
};

export type MapStageHandle = {
  /** Patches source data + density/history-edge mode flags; rebuilds the style and reapplies
   * geography layers + entity markers. Pass `{ fade: true }` for decade-flow transitions. */
  readonly patchData: (patch: MapStageDataPatch, options?: MapStageDataPatchOptions) => void;
  /** Patches the selected-state / selected-edge highlight filters (and the state-label
   * selection color) without touching source data or the style. */
  readonly applyViewState: (patch: MapStageViewPatch) => void;
  /** The only sanctioned way to move the camera (ADR-017: "raw flyTo defaults are banned").
   * Resolves `target` (an explicit center+zoom, or a bounding box via `cameraForBounds`), then
   * flies/eases/jumps according to `name`'s preset and the current reduced-motion state. */
  readonly flyPreset: (
    name: CameraPresetName,
    target: CameraFlyTarget,
    options?: MapStageFlyOptions,
  ) => void;
  /** `false` once the canvas has failed to start (WebGL unavailable, marker mount threw); pages
   * render their own graceful fallback notice off this. */
  readonly mapAvailable: boolean;
  /** Subscribes to one canvas event; returns an unsubscribe function. `'error'` and `'viewport'`
   * replay their latest value immediately to a subscriber that attaches after the fact (the
   * stage may already be alive with state from a previous page). */
  readonly subscribe: <E extends MapStageEventName>(
    event: E,
    handler: (...args: MapStageEvents[E]) => void,
  ) => () => void;
};

const MapStageContext = createContext<MapStageHandle | null>(null);

export function useMapStage(): MapStageHandle {
  const ctx = useContext(MapStageContext);
  if (!ctx) {
    throw new Error('useMapStage() must be called within a MapStageProvider');
  }
  return ctx;
}

export type MapStageProviderProps = {
  readonly initialStyle: StyleSpecification;
  readonly initialFeatureCollection: ExploreMapFeatureCollection;
  readonly initialJurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly bounds: readonly [west: number, south: number, east: number, north: number];
  readonly children: ReactNode;
};

type StageConfig = {
  style: StyleSpecification;
  featureCollection: ExploreMapFeatureCollection;
  jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  layerMode: ExploreLayerMode;
  densityLevels: readonly StateDensityLevel[];
  countyChoroplethLevels: readonly CountyChoroplethLevel[];
  clusteringEnabled: boolean;
  historyEdgesEnabled: boolean;
  historyEdgeCollection: HistoryEdgeLineCollection;
  selectedState: string | undefined;
  selectedEdge: string | undefined;
  selectedEntity: string | undefined;
};

function makeListenerStore(): {
  [K in MapStageEventName]: Set<(...args: MapStageEvents[K]) => void>;
} {
  return {
    select: new Set(),
    stateSelect: new Set(),
    edgeSelect: new Set(),
    activate: new Set(),
    viewport: new Set(),
    error: new Set(),
  };
}

function notify<E extends MapStageEventName>(
  listeners: ReturnType<typeof makeListenerStore>,
  event: E,
  ...args: MapStageEvents[E]
): void {
  for (const handler of listeners[event]) {
    handler(...args);
  }
}

export function MapStageProvider({
  initialStyle,
  initialFeatureCollection,
  initialJurisdictionAreaFeatures,
  bounds,
  children,
}: MapStageProviderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreglRef = useRef<MaplibreModule['default'] | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const stateLabelMarkersRef = useRef<
    Map<string, { readonly marker: Marker; readonly element: HTMLDivElement }>
  >(new Map());
  const listenersRef = useRef(makeListenerStore());
  const lastViewportRef = useRef<ExploreViewportFrame | undefined>(undefined);
  const [mapAvailable, setMapAvailable] = useState(true);
  const mapAvailableRef = useRef(true);

  const configRef = useRef<StageConfig>({
    style: initialStyle,
    featureCollection: initialFeatureCollection,
    jurisdictionAreaFeatures: initialJurisdictionAreaFeatures,
    layerMode: 'off',
    densityLevels: [],
    countyChoroplethLevels: [],
    clusteringEnabled: false,
    historyEdgesEnabled: false,
    historyEdgeCollection: EMPTY_EDGE_COLLECTION,
    selectedState: undefined,
    selectedEdge: undefined,
    selectedEntity: undefined,
  });
  /** Bumps when a faded `patchData` starts so an in-flight out→swap→in can abort cleanly. */
  const decadeFadeGenerationRef = useRef(0);

  const markMapUnavailable = useCallback(() => {
    if (!mapAvailableRef.current) return;
    mapAvailableRef.current = false;
    setMapAvailable(false);
    notify(listenersRef.current, 'error');
  }, []);

  const syncEntityMarkers = useCallback(() => {
    const map = mapRef.current;
    const maplibregl = maplibreglRef.current;
    if (!map || !maplibregl) return;
    try {
      syncCircularMarkers(
        map,
        maplibregl,
        configRef.current.featureCollection.features,
        markersRef.current,
        (entityId) => notify(listenersRef.current, 'select', entityId),
      );
    } catch (error) {
      console.error('[MapStage] marker sync failed', error);
      markMapUnavailable();
    }
  }, [markMapUnavailable]);

  const updateStateLabelSelection = useCallback((selectedPostalCode: string | undefined) => {
    const scheme = readDocumentColorScheme();
    for (const [postalCode, entry] of stateLabelMarkersRef.current) {
      const selected = postalCode === selectedPostalCode;
      entry.element.classList.toggle(stateLabels.STATE_LABEL_SELECTED_CLASS_NAME, selected);
      entry.element.style.color = stateLabelColorFor(scheme, selected);
    }
  }, []);

  const syncStateLabelTheme = useCallback((scheme: MapColorScheme) => {
    for (const [postalCode, entry] of stateLabelMarkersRef.current) {
      const selected = postalCode === configRef.current.selectedState;
      entry.element.classList.toggle(stateLabels.STATE_LABEL_SELECTED_CLASS_NAME, selected);
      entry.element.style.color = stateLabelColorFor(scheme, selected);
    }
  }, []);

  const updateStateLabelOpacity = useCallback((zoom: number) => {
    const opacity = String(stateLabels.stateLabelOpacityForZoom(zoom));
    for (const [, entry] of stateLabelMarkersRef.current) {
      entry.element.style.opacity = opacity;
    }
  }, []);

  const applyStyleAndData = useCallback(
    (options?: {
      readonly recreateEntitiesSource?: boolean;
      /** Keep geography layers mounted and sync paint in place — used mid decade-fade so the
       * opacity transition is not killed by remove/re-add. */
      readonly retainGeographyLayers?: boolean;
    }) => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      try {
        // Layers are removed and re-added from the rebuilt style (cheap, main-thread-only) so
        // mode-dependent paint (density tiers, edge visibility) always matches the config —
        // unless a decade fade asks to retain them so MapLibre opacity transitions can finish.
        // Sources are deliberately NOT removed on routine patches — applyGeographyStyle setDatas
        // them in place; see its doc comment. Grouping toggles pass recreateEntitiesSource.
        if (!options?.retainGeographyLayers) {
          for (const id of [
            EXPLORE_STATE_DENSITY_LAYER_ID,
            EXPLORE_COUNTY_CHOROPLETH_LAYER_ID,
            EXPLORE_COUNTY_LINES_LAYER_ID,
            EXPLORE_COUNTY_LABEL_LAYER_ID,
            'explore-state-bounds-line',
            SELECTED_FILL_ID,
            SELECTED_LINE_ID,
            'explore-jurisdiction-area-fill',
            EXPLORE_HISTORY_EDGES_LAYER_ID,
            EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
          ]) {
            if (map.getLayer(id)) map.removeLayer(id);
          }
        }

        applyGeographyStyle(map, configRef.current.style, {
          ...(options?.recreateEntitiesSource ? { recreateEntitiesSource: true } : {}),
        });
        setSelectedStateFilter(map, configRef.current.selectedState);
        setHistoryEdgeData(map, configRef.current.historyEdgeCollection);
        setHistoryEdgesVisibility(map, configRef.current.historyEdgesEnabled);
        setSelectedEdgeFilter(map, configRef.current.selectedEdge);
        setSelectedEntityFilter(map, configRef.current.selectedEntity);
        void loadStatePolygonsWithDensity(map, configRef.current.densityLevels).catch((error) => {
          console.error('[MapStage] state polygon load failed', error);
        });
        const needsCountyGeometry =
          map.getZoom() >= COUNTY_LINES_PREFETCH_ZOOM ||
          configRef.current.layerMode === 'blackShare' ||
          configRef.current.layerMode === 'blackChange';
        if (needsCountyGeometry) {
          void loadCountyPolygons(map, configRef.current.countyChoroplethLevels).catch((error) => {
            console.error('[MapStage] county polygon load failed', error);
          });
        }
        syncEntityMarkers();
      } catch (error) {
        console.error('[MapStage] style/data apply failed', error);
      }
    },
    [syncEntityMarkers],
  );

  const syncPlatePaintToTheme = useCallback(
    (map: MapLibreMap, style: StyleSpecification, scheme: MapColorScheme) => {
      syncLayerPaintFromStyle(map, style, PERSISTENT_PLATE_LAYER_IDS, (update, error) => {
        console.error(
          `[MapStage] setPaintProperty ${update.layerId}.${update.paintKey} failed`,
          error,
        );
      });
      syncStateLabelTheme(scheme);
    },
    [syncStateLabelTheme],
  );

  const commitDataPatch = useCallback(
    (patch: MapStageDataPatch, applyOptions?: Parameters<typeof applyStyleAndData>[0]) => {
      const clusteringEnabled = patch.clusteringEnabled ?? configRef.current.clusteringEnabled;
      const style = buildExploreMapStyle({
        featureCollection: patch.featureCollection,
        jurisdictionAreaFeatures: patch.jurisdictionAreaFeatures,
        layerMode: patch.layerMode,
        historyEdgesEnabled: patch.historyEdgesEnabled,
        clusteringEnabled,
        colorScheme: readDocumentColorScheme(),
      });
      configRef.current = {
        ...configRef.current,
        style,
        featureCollection: patch.featureCollection,
        jurisdictionAreaFeatures: patch.jurisdictionAreaFeatures,
        layerMode: patch.layerMode,
        densityLevels: patch.densityLevels,
        countyChoroplethLevels: patch.countyChoroplethLevels ?? [],
        clusteringEnabled,
        historyEdgesEnabled: patch.historyEdgesEnabled,
        historyEdgeCollection: patch.historyEdgeCollection,
      };
      applyStyleAndData(applyOptions);
    },
    [applyStyleAndData],
  );

  const patchData = useCallback(
    (patch: MapStageDataPatch, options?: MapStageDataPatchOptions) => {
      const clusteringEnabled = patch.clusteringEnabled ?? configRef.current.clusteringEnabled;
      const clusteringChanged = clusteringEnabled !== configRef.current.clusteringEnabled;
      const recreate = clusteringChanged ? ({ recreateEntitiesSource: true } as const) : undefined;
      const wantsFade = options?.fade === true && !prefersReducedMotion();
      const map = mapRef.current;

      if (!wantsFade || !map || !map.isStyleLoaded()) {
        // Invalidate any in-flight decade fade so a later timeout cannot overwrite this snap.
        decadeFadeGenerationRef.current += 1;
        commitDataPatch(patch, recreate);
        return;
      }

      const generation = ++decadeFadeGenerationRef.current;
      const durationMs = DECADE_LAYER_FADE_MS;
      setDecadeFadeTransitions(map, durationMs);
      setDecadeFadeOpacities(map, 0);

      window.setTimeout(() => {
        if (generation !== decadeFadeGenerationRef.current) return;
        commitDataPatch(patch, {
          ...(recreate ?? {}),
          retainGeographyLayers: true,
        });
        // Hold the new frame at opacity 0 (no transition), then fade literals in.
        setDecadeFadeTransitions(map, 0);
        setDecadeFadeOpacities(map, 0);
        requestAnimationFrame(() => {
          if (generation !== decadeFadeGenerationRef.current) return;
          setDecadeFadeTransitions(map, durationMs);
          setDecadeFadeInLiterals(map);
          window.setTimeout(() => {
            if (generation !== decadeFadeGenerationRef.current) return;
            // Snap kind-aware expressions back once the literal fade has settled.
            setDecadeFadeTransitions(map, 0);
            restoreDecadeFadePaintFromStyle(map, configRef.current.style);
          }, durationMs);
        });
      }, durationMs);
    },
    [commitDataPatch],
  );

  useEffect(() => {
    const syncPlateToTheme = () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      const cfg = configRef.current;
      const scheme = readDocumentColorScheme();
      const style = buildExploreMapStyle({
        featureCollection: cfg.featureCollection,
        jurisdictionAreaFeatures: cfg.jurisdictionAreaFeatures,
        layerMode: cfg.layerMode,
        historyEdgesEnabled: cfg.historyEdgesEnabled,
        clusteringEnabled: cfg.clusteringEnabled,
        colorScheme: scheme,
      });
      configRef.current = { ...cfg, style };
      applyStyleAndData();
      syncPlatePaintToTheme(map, style, scheme);
    };
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'data-theme')) {
        syncPlateToTheme();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [applyStyleAndData, syncPlatePaintToTheme]);

  const applyViewState = useCallback(
    (patch: MapStageViewPatch) => {
      configRef.current = {
        ...configRef.current,
        selectedState: patch.selectedState,
        selectedEdge: patch.selectedEdge,
        selectedEntity: patch.selectedEntity,
      };
      updateStateLabelSelection(patch.selectedState);
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      setSelectedStateFilter(map, patch.selectedState);
      setSelectedEdgeFilter(map, patch.selectedEdge);
      setSelectedEntityFilter(map, patch.selectedEntity);
    },
    [updateStateLabelSelection],
  );

  const flyPreset = useCallback(
    (name: CameraPresetName, target: CameraFlyTarget, options?: MapStageFlyOptions) => {
      const map = mapRef.current;
      if (!map) return;
      const reduced = prefersReducedMotion();
      const preset = cameraPresetFor(name, reduced);

      let center: [number, number];
      let zoom: number;
      if ('center' in target) {
        center = [target.center[0], target.center[1]];
        zoom = target.zoom;
      } else {
        const [west, south, east, north] = target.bounds;
        const camera = (() => {
          try {
            return map.cameraForBounds(
              [west, south, east, north] as [number, number, number, number],
              {
                padding: preset.padding,
              },
            );
          } catch (error) {
            console.error('[MapStage] cameraForBounds failed', error);
            return undefined;
          }
        })();
        if (camera?.center && typeof camera.zoom === 'number') {
          center = lngLatTuple(camera.center);
          zoom = camera.zoom;
        } else {
          center = [(west + east) / 2, (south + north) / 2];
          zoom = 3.4;
        }
      }

      const paddingOption = options?.padding ?? preset.padding;
      const padding =
        typeof paddingOption === 'number'
          ? { top: paddingOption, bottom: paddingOption, left: paddingOption, right: paddingOption }
          : paddingOption;

      if (reduced || preset.duration <= 0) {
        map.jumpTo({ center, zoom, padding });
        return;
      }
      if ((options?.mode ?? 'fly') === 'ease') {
        map.easeTo({
          center,
          zoom,
          padding,
          duration: preset.duration,
          easing: preset.easing,
          essential: true,
        });
      } else {
        map.flyTo({
          center,
          zoom,
          padding,
          duration: preset.duration,
          curve: preset.curve,
          speed: preset.speed,
          easing: preset.easing,
          essential: true,
        });
      }
    },
    [],
  );

  const subscribe = useCallback(
    <E extends MapStageEventName>(
      event: E,
      handler: (...args: MapStageEvents[E]) => void,
    ): (() => void) => {
      const set = listenersRef.current[event];
      set.add(handler);
      // Latch: replay the most recent value to a subscriber that attaches after the fact — the
      // stage may already be alive with state from a page that mounted earlier this session.
      if (event === 'error' && !mapAvailableRef.current) {
        (handler as () => void)();
      }
      if (event === 'viewport' && lastViewportRef.current) {
        (handler as (viewport: ExploreViewportFrame) => void)(lastViewportRef.current);
      }
      return () => {
        set.delete(handler);
      };
    },
    [],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let resizeObserver: ResizeObserver | undefined;

    void (async () => {
      let map: MapLibreMap | undefined;
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        maplibreglRef.current = maplibregl;
        if (cancelled || !container.isConnected) return;

        map = new maplibregl.Map({
          container,
          style: ARCHIVE_BASE_STYLE,
          attributionControl: false,
          // Keep the camera US-centered without a tight maxBounds box (see the former
          // ExploreMapCanvas's identical comment): a portrait canvas cannot show full CONUS
          // east-west if maxBounds also caps latitude.
          renderWorldCopies: false,
          // Street-level context is available (OpenFreeMap roads from z8); stop short of
          // address-level invasion — precision redaction still governs marker honesty.
          minZoom: 3,
          maxZoom: 14,
          bounds: bounds as [number, number, number, number],
          fitBoundsOptions: { padding: 32 },
        });

        mapRef.current = map;
        if (process.env.NODE_ENV !== 'production') {
          // Dev-only escape hatch for in-browser inspection and perf traces.
          (window as unknown as Record<string, unknown>).__bpMapStage = map;
        }
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('error', (event) => {
          console.error('[MapStage]', event.error);
        });
      } catch {
        if (!cancelled) markMapUnavailable();
        return;
      }

      if (cancelled || !map) {
        map?.remove();
        mapRef.current = null;
        return;
      }

      const activeMap = map;

      // State-label markers mount first so, by DOM insertion order, entity markers layer above
      // them (state-labels.ts's documented belt-and-suspenders stacking guidance).
      const descriptors = stateLabels.buildStateLabelMarkers(configRef.current.selectedState);
      for (const descriptor of descriptors) {
        const element = stateLabels.buildStateLabelElement(descriptor);
        const marker = new (maplibreglRef.current as MaplibreModule['default']).Marker({
          element,
          anchor: 'center',
        })
          .setLngLat([descriptor.lngLat[0], descriptor.lngLat[1]])
          .addTo(activeMap);
        stateLabelMarkersRef.current.set(descriptor.postalCode, { marker, element });
      }
      syncStateLabelTheme(readDocumentColorScheme());
      updateStateLabelOpacity(activeMap.getZoom());

      syncEntityMarkers();
      lastViewportRef.current = readViewport(activeMap);
      notify(listenersRef.current, 'viewport', lastViewportRef.current);

      /** True when an entity marker or cluster is rendered under the click point. GL circle
       * layers have no DOM to stopPropagation from (unlike the overlay marker buttons), so the
       * layer-scoped state/edge click handlers must yield to them explicitly — otherwise one
       * cluster click would both expand the cluster and select the state beneath it. */
      function entityHitAt(point: { x: number; y: number }): boolean {
        const layers = [
          EXPLORE_CLUSTER_LAYER_ID,
          EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
          EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
        ].filter((id) => activeMap.getLayer(id));
        return (
          layers.length > 0 &&
          activeMap.queryRenderedFeatures([point.x, point.y], { layers }).length > 0
        );
      }

      function handleStateClick(event: MapLayerMouseEvent) {
        if (entityHitAt(event.point)) return;
        const postal = event.features?.[0]?.properties?.postalCode;
        if (typeof postal === 'string' && postal.length > 0) {
          notify(listenersRef.current, 'stateSelect', postal);
        }
      }

      function handleEdgeClick(event: MapLayerMouseEvent) {
        if (entityHitAt(event.point)) return;
        const edgeId = event.features?.[0]?.properties?.edgeId;
        if (typeof edgeId === 'string' && edgeId.length > 0) {
          notify(listenersRef.current, 'edgeSelect', edgeId);
        }
      }

      function handleBackgroundClick(event: MapMouseEvent) {
        const hitLayers = [
          EXPLORE_STATE_DENSITY_LAYER_ID,
          EXPLORE_HISTORY_EDGES_LAYER_ID,
          EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
          EXPLORE_CLUSTER_LAYER_ID,
          EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
          EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
        ].filter((id) => activeMap.getLayer(id));
        const hits = hitLayers.length
          ? activeMap.queryRenderedFeatures(event.point, { layers: hitLayers })
          : [];
        if (hits.length > 0) return;
        notify(listenersRef.current, 'activate', readViewport(activeMap));
      }

      activeMap.once('load', () => {
        applyStyleAndData();
        if (activeMap.getLayer(EXPLORE_STATE_DENSITY_LAYER_ID)) {
          activeMap.on('click', EXPLORE_STATE_DENSITY_LAYER_ID, handleStateClick);
          activeMap.on('mouseenter', EXPLORE_STATE_DENSITY_LAYER_ID, () => {
            activeMap.getCanvas().style.cursor = 'pointer';
          });
          activeMap.on('mouseleave', EXPLORE_STATE_DENSITY_LAYER_ID, () => {
            activeMap.getCanvas().style.cursor = '';
          });
        }
        if (activeMap.getLayer(EXPLORE_HISTORY_EDGES_LAYER_ID)) {
          activeMap.on('click', EXPLORE_HISTORY_EDGES_LAYER_ID, handleEdgeClick);
          activeMap.on('mouseenter', EXPLORE_HISTORY_EDGES_LAYER_ID, () => {
            activeMap.getCanvas().style.cursor = 'pointer';
          });
          activeMap.on('mouseleave', EXPLORE_HISTORY_EDGES_LAYER_ID, () => {
            activeMap.getCanvas().style.cursor = '';
          });
        }
        activeMap.on('click', handleBackgroundClick);
        activeMap.resize();
      });

      activeMap.on('moveend', () => {
        lastViewportRef.current = readViewport(activeMap);
        notify(listenersRef.current, 'viewport', lastViewportRef.current);
        updateStateLabelOpacity(activeMap.getZoom());
      });
      activeMap.on('zoom', () => updateStateLabelOpacity(activeMap.getZoom()));
      activeMap.on('zoomend', () => {
        syncEntityMarkers();
        const cfg = configRef.current;
        if (
          activeMap.getZoom() >= COUNTY_LINES_PREFETCH_ZOOM ||
          cfg.layerMode === 'blackShare' ||
          cfg.layerMode === 'blackChange'
        ) {
          void loadCountyPolygons(activeMap, cfg.countyChoroplethLevels).catch((error) => {
            console.error('[MapStage] county polygon load failed', error);
          });
        }
      });

      // Cluster expansion (dignity-style.ts's EXPLORE_CLUSTER_CONFIG contract: "every cluster
      // decomposes to named entities within two interactions") — clicking a cluster circle
      // eases down to the zoom where that cluster splits. Registered up-front even though the
      // layer is added post-load: MapLibre's layer-scoped events resolve the layer at event
      // time, so a not-yet-added layer is simply never hit.
      activeMap.on('click', EXPLORE_CLUSTER_LAYER_ID, (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        const source = activeMap.getSource(EXPLORE_ENTITIES_SOURCE_ID) as GeoJSONSource | undefined;
        if (typeof clusterId !== 'number' || !source || feature?.geometry.type !== 'Point') return;
        const [lng, lat] = feature.geometry.coordinates;
        void source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            if (typeof lng === 'number' && typeof lat === 'number') {
              activeMap.easeTo({ center: [lng, lat], zoom, essential: true });
            }
          })
          .catch(() => {
            // Cluster may have dissolved between click and lookup (data patch mid-flight);
            // nothing to expand.
          });
      });
      activeMap.on('mouseenter', EXPLORE_CLUSTER_LAYER_ID, () => {
        activeMap.getCanvas().style.cursor = 'pointer';
      });
      activeMap.on('mouseleave', EXPLORE_CLUSTER_LAYER_ID, () => {
        activeMap.getCanvas().style.cursor = '';
      });

      // Individual pins (GL circle) — works at every zoom once unclustered; complements the
      // zoom-gated HTML hit-targets so selection does not depend on DOM overlays alone.
      const selectFromUnclustered = (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const entityId = feature?.properties?.entityId;
        if (typeof entityId === 'string' && entityId.length > 0) {
          event.originalEvent?.stopPropagation();
          notify(listenersRef.current, 'select', entityId);
        }
      };
      activeMap.on('click', EXPLORE_UNCLUSTERED_POINT_LAYER_ID, selectFromUnclustered);
      activeMap.on('click', EXPLORE_UNCLUSTERED_HALO_LAYER_ID, selectFromUnclustered);
      activeMap.on('mouseenter', EXPLORE_UNCLUSTERED_POINT_LAYER_ID, () => {
        activeMap.getCanvas().style.cursor = 'pointer';
      });
      activeMap.on('mouseleave', EXPLORE_UNCLUSTERED_POINT_LAYER_ID, () => {
        activeMap.getCanvas().style.cursor = '';
      });

      resizeObserver = new ResizeObserver(() => {
        activeMap.resize();
      });
      resizeObserver.observe(container);
      resizeTimer = setTimeout(() => {
        syncEntityMarkers();
        activeMap.resize();
      }, 200);
    })();

    return () => {
      cancelled = true;
      decadeFadeGenerationRef.current += 1;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      clearMarkers(markersRef.current);
      for (const { marker } of stateLabelMarkersRef.current.values()) marker.remove();
      stateLabelMarkersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreglRef.current = null;
    };
    // Empty deps, deliberately: this effect must run exactly once for the app's lifetime. The
    // `(map)` layout that renders `MapStageProvider` never remounts across `/` <-> `/explore`
    // navigations (ADR-017) — that persistence IS the point, so this must not re-run on prop
    // changes the way a per-page canvas component's effects used to.
  }, []);

  const handle = useMemo<MapStageHandle>(
    () => ({ patchData, applyViewState, flyPreset, subscribe, mapAvailable }),
    [patchData, applyViewState, flyPreset, subscribe, mapAvailable],
  );

  return (
    <MapStageContext.Provider value={handle}>
      {/* The sole persistent canvas element (ADR-017). `.ds-map-stage` is a fixed full-viewport
          plate behind page chrome (map-surfaces.css); `maplibregl.Map`'s `container` must be a
          separate inner div, never the plate itself — MapLibre stamps its own `maplibregl-map`
          class onto whatever container it's given, and maplibre-gl.css hard-codes
          `position: relative` on that class, which would silently clobber the plate's
          `position: fixed` (same element, same specificity, later cascade wins) and put the
          canvas back in normal document flow. `aria-hidden` on the plate: the synchronized
          result list is this map's accessible-parity surface (see `syncCircularMarkers`'s doc
          comment on marker `tabIndex`), so the canvas itself carries no separate a11y tree. */}
      <div className="ds-map-stage" aria-hidden="true">
        <div ref={containerRef} className="ds-map-stage__canvas" />
      </div>
      {children}
    </MapStageContext.Provider>
  );
}
