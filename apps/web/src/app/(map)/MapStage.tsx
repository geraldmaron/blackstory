'use client';

/**
 * The persistent map canvas (BB-098, ADR-017 "Persistent map canvas — one MapLibre instance
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
import { brandPalette, darkTheme } from '@black-book/ui';
import {
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
} from '../map/explore-layer-ids';
import { buildExploreMapStyle } from '../map/explore-style';
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
import { joinDensityOntoStatePolygons } from '../../lib/map-experience/join-state-polygons';
import {
  buildStateLabelElement,
  buildStateLabelMarkers,
  stateLabelOpacityForZoom,
  STATE_LABEL_SELECTED_CLASS_NAME,
} from '../../lib/map-experience/state-labels';
import { US_STATES_GEOJSON_PATH } from '../../lib/map-experience/us-state-polygons';
import type { ExploreViewport } from '../../lib/map-experience/url-state';

type MaplibreModule = typeof MapLibreNamespace;

const SELECTED_FILL_ID = 'explore-state-selected-fill';
const SELECTED_LINE_ID = 'explore-state-selected-line';

const EMPTY_EDGE_COLLECTION: HistoryEdgeLineCollection = { type: 'FeatureCollection', features: [] };

const ARCHIVE_BASE_STYLE: StyleSpecification = {
  version: 8,
  name: 'Black Book — Archive (US)',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      // Near-black plate: the "rest of the world" stays unmapped, grayed by absence.
      paint: { 'background-color': '#121212' },
    },
  ],
};

const GEOGRAPHY_LAYER_IDS = new Set([
  'background',
  'explore-state-density-fill',
  'explore-state-bounds-line',
  'explore-state-selected-fill',
  'explore-state-selected-line',
  'explore-jurisdiction-area-fill',
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
]);

/** Normalizes `maplibre-gl`'s `LngLatLike` union (a `LngLat` instance, a `{lng,lat}` or
 * `{lon,lat}` object literal, or a `[lng, lat]` tuple) to a plain tuple. `cameraForBounds`
 * types its result this loosely even though the runtime value is always a `LngLat` instance. */
function lngLatTuple(value: LngLatLike): [number, number] {
  if (Array.isArray(value)) return [value[0], value[1]];
  if ('lng' in value) return [value.lng, value.lat];
  return [value.lon, value.lat];
}

function readViewport(map: MapLibreMap): ExploreViewport {
  const center = map.getCenter();
  return { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
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

  for (const feature of features) {
    if (feature.geometry.type !== 'Point') continue;
    const [lng, lat] = feature.geometry.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    const entityId = feature.properties.entityId;
    if (typeof entityId !== 'string') continue;

    const label =
      typeof feature.properties.displayName === 'string' ? feature.properties.displayName : 'Documented record';

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'bb-map-entity-marker';
    el.setAttribute('aria-label', label);
    el.title = label;
    // The map canvas is `aria-hidden` (see `MapStageProvider`'s render) — the synchronized
    // result list is the accessible-parity surface for the same entities (NarrativeCard's doc
    // comment), so these buttons are deliberately pulled out of the tab order rather than left
    // focusable-but-hidden (a WAI-ARIA anti-pattern).
    el.tabIndex = -1;
    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(entityId);
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
    markers.push(marker);
  }
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

function applyGeographyStyle(map: MapLibreMap, style: StyleSpecification): void {
  for (const [id, source] of Object.entries(style.sources ?? {})) {
    if (id === 'explore-entities') continue;
    const existing = map.getSource(id) as GeoJSONSource | undefined;
    if (existing) {
      // Update in place — NEVER removeSource/addSource on a data patch. Re-adding a source id
      // while the worker is still tearing the old one down corrupts the internal GeoJSON tile
      // pyramid (only the tile in flight at teardown ever renders again), and patches land in
      // quick succession on mount (hero reset + explore sync, doubled by dev StrictMode).
      // The density source is skipped here: its inline style data is an empty placeholder, and
      // `loadStatePolygonsWithDensity` overwrites it with the real joined polygons right after
      // every apply — setData'ing the placeholder first would just blank-flash the states.
      if (id === EXPLORE_STATE_DENSITY_SOURCE_ID) continue;
      const data = (source as { data?: unknown }).data;
      if (typeof existing.setData === 'function' && data && typeof data === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        existing.setData(data as any);
      }
      continue;
    }
    map.addSource(id, source as SourceSpecification);
  }
  for (const layer of style.layers ?? []) {
    if (!GEOGRAPHY_LAYER_IDS.has(layer.id) || layer.id === 'background') continue;
    if (!map.getLayer(layer.id)) {
      map.addLayer(layer as LayerSpecification);
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
 * its MapLibre style from this every call (via `buildExploreMapStyle`, BB-099's style builder —
 * consumed here, never modified) and reapplies geography layers + resyncs entity markers. Always
 * the FULL current shape, not a delta — mirrors how `ExploreMapCanvas` used to receive these as
 * plain re-render props. */
export type MapStageDataPatch = {
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly densityEnabled: boolean;
  readonly densityLevels: readonly StateDensityLevel[];
  readonly historyEdgesEnabled: boolean;
  readonly historyEdgeCollection: HistoryEdgeLineCollection;
};

/** Selection-only view state: cheap filter/paint updates, no style rebuild. `undefined` clears
 * the corresponding selection (always pass both — this is the current full selection, not a
 * delta, same convention as `MapStageDataPatch`). */
export type MapStageViewPatch = {
  readonly selectedState: string | undefined;
  readonly selectedEdge: string | undefined;
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
};

type MapStageEvents = {
  select: [entityId: string];
  stateSelect: [postalCode: string];
  edgeSelect: [edgeId: string];
  /** Fired on a background click when nothing else (state, edge) was hit — the
   * `activateOnBackgroundClick` behavior `HomeMapHero` used to opt into via a prop. Now every
   * surface gets the event; only the ones that `subscribe('activate', …)` act on it, which is an
   * equivalent opt-in. */
  activate: [viewport: ExploreViewport];
  viewport: [viewport: ExploreViewport];
  error: [];
};

type MapStageEventName = keyof MapStageEvents;

export type MapStageHandle = {
  /** Patches source data + density/history-edge mode flags; rebuilds the style and reapplies
   * geography layers + entity markers. */
  readonly patchData: (patch: MapStageDataPatch) => void;
  /** Patches the selected-state / selected-edge highlight filters (and the state-label
   * selection color) without touching source data or the style. */
  readonly applyViewState: (patch: MapStageViewPatch) => void;
  /** The only sanctioned way to move the camera (ADR-017: "raw flyTo defaults are banned").
   * Resolves `target` (an explicit center+zoom, or a bounding box via `cameraForBounds`), then
   * flies/eases/jumps according to `name`'s preset and the current reduced-motion state. */
  readonly flyPreset: (name: CameraPresetName, target: CameraFlyTarget, options?: MapStageFlyOptions) => void;
  /** `false` once the canvas has failed to start (WebGL unavailable, marker mount threw); pages
   * render their own graceful fallback notice off this. */
  readonly mapAvailable: boolean;
  /** Subscribes to one canvas event; returns an unsubscribe function. `'error'` and `'viewport'`
   * replay their latest value immediately to a subscriber that attaches after the fact (the
   * stage may already be alive with state from a previous page). */
  readonly subscribe: <E extends MapStageEventName>(event: E, handler: (...args: MapStageEvents[E]) => void) => () => void;
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
  densityEnabled: boolean;
  densityLevels: readonly StateDensityLevel[];
  historyEdgesEnabled: boolean;
  historyEdgeCollection: HistoryEdgeLineCollection;
  selectedState: string | undefined;
  selectedEdge: string | undefined;
};

function makeListenerStore(): { [K in MapStageEventName]: Set<(...args: MapStageEvents[K]) => void> } {
  return { select: new Set(), stateSelect: new Set(), edgeSelect: new Set(), activate: new Set(), viewport: new Set(), error: new Set() };
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
  const stateLabelMarkersRef = useRef<Map<string, { readonly marker: Marker; readonly element: HTMLDivElement }>>(
    new Map(),
  );
  const listenersRef = useRef(makeListenerStore());
  const lastViewportRef = useRef<ExploreViewport | undefined>(undefined);
  const [mapAvailable, setMapAvailable] = useState(true);
  const mapAvailableRef = useRef(true);

  const configRef = useRef<StageConfig>({
    style: initialStyle,
    featureCollection: initialFeatureCollection,
    jurisdictionAreaFeatures: initialJurisdictionAreaFeatures,
    densityEnabled: false,
    densityLevels: [],
    historyEdgesEnabled: false,
    historyEdgeCollection: EMPTY_EDGE_COLLECTION,
    selectedState: undefined,
    selectedEdge: undefined,
  });

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
      syncCircularMarkers(map, maplibregl, configRef.current.featureCollection.features, markersRef.current, (entityId) =>
        notify(listenersRef.current, 'select', entityId),
      );
    } catch (error) {
      console.error('[MapStage] marker sync failed', error);
      markMapUnavailable();
    }
  }, [markMapUnavailable]);

  const updateStateLabelSelection = useCallback((selectedPostalCode: string | undefined) => {
    for (const [postalCode, entry] of stateLabelMarkersRef.current) {
      const selected = postalCode === selectedPostalCode;
      entry.element.classList.toggle(STATE_LABEL_SELECTED_CLASS_NAME, selected);
      entry.element.style.color = selected ? brandPalette.copperDark : darkTheme.inkMuted;
    }
  }, []);

  const updateStateLabelOpacity = useCallback((zoom: number) => {
    const opacity = String(stateLabelOpacityForZoom(zoom));
    for (const [, entry] of stateLabelMarkersRef.current) {
      entry.element.style.opacity = opacity;
    }
  }, []);

  const applyStyleAndData = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      // Layers are removed and re-added from the rebuilt style (cheap, main-thread-only) so
      // mode-dependent paint (density tiers, edge visibility) always matches the config.
      // Sources are deliberately NOT removed — applyGeographyStyle setDatas them in place;
      // see its doc comment for the worker-teardown corruption that removeSource+addSource
      // of the same id causes.
      for (const id of [
        EXPLORE_STATE_DENSITY_LAYER_ID,
        'explore-state-bounds-line',
        SELECTED_FILL_ID,
        SELECTED_LINE_ID,
        'explore-jurisdiction-area-fill',
        EXPLORE_HISTORY_EDGES_LAYER_ID,
        EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
      ]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }

      applyGeographyStyle(map, configRef.current.style);
      setSelectedStateFilter(map, configRef.current.selectedState);
      setHistoryEdgeData(map, configRef.current.historyEdgeCollection);
      setHistoryEdgesVisibility(map, configRef.current.historyEdgesEnabled);
      setSelectedEdgeFilter(map, configRef.current.selectedEdge);
      void loadStatePolygonsWithDensity(map, configRef.current.densityLevels).catch((error) => {
        console.error('[MapStage] state polygon load failed', error);
      });
      syncEntityMarkers();
    } catch (error) {
      console.error('[MapStage] style/data apply failed', error);
    }
  }, [syncEntityMarkers]);

  const patchData = useCallback(
    (patch: MapStageDataPatch) => {
      const style = buildExploreMapStyle({
        featureCollection: patch.featureCollection,
        jurisdictionAreaFeatures: patch.jurisdictionAreaFeatures,
        densityLayerEnabled: patch.densityEnabled,
        historyEdgesEnabled: patch.historyEdgesEnabled,
      });
      configRef.current = {
        ...configRef.current,
        style,
        featureCollection: patch.featureCollection,
        jurisdictionAreaFeatures: patch.jurisdictionAreaFeatures,
        densityEnabled: patch.densityEnabled,
        densityLevels: patch.densityLevels,
        historyEdgesEnabled: patch.historyEdgesEnabled,
        historyEdgeCollection: patch.historyEdgeCollection,
      };
      applyStyleAndData();
    },
    [applyStyleAndData],
  );

  const applyViewState = useCallback(
    (patch: MapStageViewPatch) => {
      configRef.current = { ...configRef.current, selectedState: patch.selectedState, selectedEdge: patch.selectedEdge };
      updateStateLabelSelection(patch.selectedState);
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      setSelectedStateFilter(map, patch.selectedState);
      setSelectedEdgeFilter(map, patch.selectedEdge);
    },
    [updateStateLabelSelection],
  );

  const flyPreset = useCallback((name: CameraPresetName, target: CameraFlyTarget, options?: MapStageFlyOptions) => {
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
          return map.cameraForBounds([west, south, east, north] as [number, number, number, number], {
            padding: preset.padding,
          });
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

    const padding = { top: preset.padding, bottom: preset.padding, left: preset.padding, right: preset.padding };

    if (reduced || preset.duration <= 0) {
      map.jumpTo({ center, zoom, padding });
      return;
    }
    if ((options?.mode ?? 'fly') === 'ease') {
      map.easeTo({ center, zoom, padding, duration: preset.duration, easing: preset.easing, essential: true });
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
  }, []);

  const subscribe = useCallback(
    <E extends MapStageEventName>(event: E, handler: (...args: MapStageEvents[E]) => void): (() => void) => {
      const set = listenersRef.current[event];
      set.add(handler);
      // Latch: replay the most recent value to a subscriber that attaches after the fact — the
      // stage may already be alive with state from a page that mounted earlier this session.
      if (event === 'error' && !mapAvailableRef.current) {
        (handler as () => void)();
      }
      if (event === 'viewport' && lastViewportRef.current) {
        (handler as (viewport: ExploreViewport) => void)(lastViewportRef.current);
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
          minZoom: 2.5,
          maxZoom: 12,
          bounds: bounds as [number, number, number, number],
          fitBoundsOptions: { padding: 32 },
        });

        mapRef.current = map;
        if (process.env.NODE_ENV !== 'production') {
          // Dev-only escape hatch for in-browser inspection and BB-101 perf traces.
          (window as unknown as Record<string, unknown>).__bbMapStage = map;
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
      const descriptors = buildStateLabelMarkers(configRef.current.selectedState);
      for (const descriptor of descriptors) {
        const element = buildStateLabelElement(descriptor);
        const marker = new (maplibreglRef.current as MaplibreModule['default']).Marker({ element, anchor: 'center' })
          .setLngLat([descriptor.lngLat[0], descriptor.lngLat[1]])
          .addTo(activeMap);
        stateLabelMarkersRef.current.set(descriptor.postalCode, { marker, element });
      }
      updateStateLabelOpacity(activeMap.getZoom());

      syncEntityMarkers();
      lastViewportRef.current = readViewport(activeMap);
      notify(listenersRef.current, 'viewport', lastViewportRef.current);

      function handleStateClick(event: MapLayerMouseEvent) {
        const postal = event.features?.[0]?.properties?.postalCode;
        if (typeof postal === 'string' && postal.length > 0) {
          notify(listenersRef.current, 'stateSelect', postal);
        }
      }

      function handleEdgeClick(event: MapLayerMouseEvent) {
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
        ].filter((id) => activeMap.getLayer(id));
        const hits = hitLayers.length ? activeMap.queryRenderedFeatures(event.point, { layers: hitLayers }) : [];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handle = useMemo<MapStageHandle>(
    () => ({ patchData, applyViewState, flyPreset, subscribe, mapAvailable }),
    [patchData, applyViewState, flyPreset, subscribe, mapAvailable],
  );

  return (
    <MapStageContext.Provider value={handle}>
      {/* The sole persistent canvas element (ADR-017). `.bb-map-stage` is a fixed full-viewport
          plate behind page chrome (map-surfaces.css); `maplibregl.Map`'s `container` must be a
          separate inner div, never the plate itself — MapLibre stamps its own `maplibregl-map`
          class onto whatever container it's given, and maplibre-gl.css hard-codes
          `position: relative` on that class, which would silently clobber the plate's
          `position: fixed` (same element, same specificity, later cascade wins) and put the
          canvas back in normal document flow. `aria-hidden` on the plate: the synchronized
          result list is this map's accessible-parity surface (see `syncCircularMarkers`'s doc
          comment on marker `tabIndex`), so the canvas itself carries no separate a11y tree. */}
      <div className="bb-map-stage" aria-hidden="true">
        <div ref={containerRef} className="bb-map-stage__canvas" />
      </div>
      {children}
    </MapStageContext.Provider>
  );
}
