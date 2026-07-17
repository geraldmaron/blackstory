'use client';

/**
 * Interactive MapLibre canvas for the national map experience.
 *
 * Branded dark-archive canvas (black ink + white state strokes + copper HTML markers).
 * Optional History relationship LineStrings. No world basemap tiles the rest of the globe
 * stays out of frame uncolored until we deliberately add countries.
 */
import { useEffect, useRef } from 'react';
import type {
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
  Marker,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import type * as MapLibreNamespace from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
} from './explore-layer-ids';
import type { StateDensityLevel } from '../../lib/map-experience/density';
import type { HistoryEdgeLineCollection } from '../../lib/map-experience/build-history-edge-lines';
import { joinDensityOntoStatePolygons } from '../../lib/map-experience/join-state-polygons';
import { US_STATES_GEOJSON_PATH } from '../../lib/map-experience/us-state-polygons';
import type { ExploreViewport } from '../../lib/map-experience/url-state';

export type ExploreMapFeatureCollection = {
  readonly type: 'FeatureCollection';
  readonly features: readonly {
    readonly type: 'Feature';
    readonly geometry: { readonly type: string; readonly coordinates: readonly number[] };
    readonly properties: Record<string, unknown>;
  }[];
};

export type ExploreMapCanvasProps = {
  readonly style: StyleSpecification;
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly bounds: readonly [west: number, south: number, east: number, north: number];
  readonly initialViewport?: ExploreViewport;
  readonly densityEnabled: boolean;
  readonly densityLevels?: readonly StateDensityLevel[];
  readonly selectedState?: string;
  readonly historyEdgesEnabled?: boolean;
  readonly historyEdgeCollection?: HistoryEdgeLineCollection;
  readonly selectedEdge?: string;
  /** When true, empty-map clicks (not on a pin/state/edge) call onActivate.  */
  readonly activateOnBackgroundClick?: boolean;
  readonly className?: string;
  readonly onSelect?: (entityId: string) => void;
  readonly onStateSelect?: (postalCode: string) => void;
  readonly onEdgeSelect?: (edgeId: string) => void;
  readonly onActivate?: (viewport: ExploreViewport) => void;
  readonly onViewportChange?: (viewport: ExploreViewport) => void;
  readonly onMapError?: () => void;
};

type MaplibreModule = typeof MapLibreNamespace;

const SELECTED_FILL_ID = 'explore-state-selected-fill';
const SELECTED_LINE_ID = 'explore-state-selected-line';

function readViewport(map: MapLibreMap): ExploreViewport {
  const center = map.getCenter();
  return { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
}

function cloneMapStyle(style: StyleSpecification): StyleSpecification {
  return JSON.parse(JSON.stringify(style)) as StyleSpecification;
}

const ARCHIVE_BASE_STYLE: StyleSpecification = {
  version: 8,
  name: 'Black Book — Archive (US)',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      // Near-black plate: the “rest of the world” stays unmapped grayed by absence.
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

const EMPTY_EDGE_COLLECTION: HistoryEdgeLineCollection = {
  type: 'FeatureCollection',
  features: [],
};

function setHistoryEdgeData(
  map: MapLibreMap,
  collection: HistoryEdgeLineCollection,
): void {
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
  features: {
    type: string;
    id?: string;
    properties: Record<string, unknown>;
    geometry: unknown;
  }[];
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
  const next = cloneMapStyle(style);

  for (const [id, source] of Object.entries(next.sources ?? {})) {
    if (id === 'explore-entities') continue;
    if (map.getSource(id)) continue;
    map.addSource(id, source as SourceSpecification);
  }

  for (const layer of next.layers ?? []) {
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

function clearMarkers(markers: Marker[]): void {
  for (const marker of markers) marker.remove();
  markers.length = 0;
}

function syncCircularMarkers(
  map: MapLibreMap,
  maplibregl: MaplibreModule['default'],
  features: ExploreMapFeatureCollection['features'],
  markers: Marker[],
  onSelect: ((entityId: string) => void) | undefined,
): void {
  clearMarkers(markers);

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
    el.className = 'bb-map-entity-marker';
    el.setAttribute('aria-label', label);
    el.title = label;
    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect?.(entityId);
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map);
    markers.push(marker);
  }
}

export function ExploreMapCanvas({
  style,
  featureCollection,
  bounds,
  initialViewport,
  densityEnabled,
  densityLevels = [],
  selectedState,
  historyEdgesEnabled = false,
  historyEdgeCollection = EMPTY_EDGE_COLLECTION,
  selectedEdge,
  activateOnBackgroundClick = false,
  className,
  onSelect,
  onStateSelect,
  onEdgeSelect,
  onActivate,
  onViewportChange,
  onMapError,
}: ExploreMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreglRef = useRef<MaplibreModule['default'] | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const handlersRef = useRef({
    onSelect,
    onStateSelect,
    onEdgeSelect,
    onActivate,
    onViewportChange,
    onMapError,
  });
  handlersRef.current = {
    onSelect,
    onStateSelect,
    onEdgeSelect,
    onActivate,
    onViewportChange,
    onMapError,
  };
  const styleRef = useRef(style);
  const boundsRef = useRef(bounds);
  const viewportRef = useRef(initialViewport);
  const densityRef = useRef(densityEnabled);
  const densityLevelsRef = useRef(densityLevels);
  const selectedStateRef = useRef(selectedState);
  const historyEdgesEnabledRef = useRef(historyEdgesEnabled);
  const historyEdgeCollectionRef = useRef(historyEdgeCollection);
  const selectedEdgeRef = useRef(selectedEdge);
  const featuresRef = useRef(featureCollection);
  const activateRef = useRef(activateOnBackgroundClick);
  styleRef.current = style;
  boundsRef.current = bounds;
  viewportRef.current = initialViewport;
  densityRef.current = densityEnabled;
  densityLevelsRef.current = densityLevels;
  selectedStateRef.current = selectedState;
  historyEdgesEnabledRef.current = historyEdgesEnabled;
  historyEdgeCollectionRef.current = historyEdgeCollection;
  selectedEdgeRef.current = selectedEdge;
  featuresRef.current = featureCollection;
  activateRef.current = activateOnBackgroundClick;

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

        const currentViewport = viewportRef.current;
        map = new maplibregl.Map({
          container,
          style: ARCHIVE_BASE_STYLE,
          attributionControl: false,
          // Keep the camera US-centered without a tight maxBounds box. A portrait canvas
          // cannot show full CONUS east–west if maxBounds also caps latitude (MapLibre
          // raises min zoom to hide out-of-bounds lat, which clips the coasts).
          renderWorldCopies: false,
          minZoom: 2.5,
          maxZoom: 12,
          ...(currentViewport
            ? {
                center: [currentViewport.lng, currentViewport.lat] as [number, number],
                zoom: currentViewport.zoom,
              }
            : {
                bounds: boundsRef.current as [number, number, number, number],
                fitBoundsOptions: { padding: 32 },
              }),
        });

        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('error', (event) => {
          console.error('[ExploreMapCanvas]', event.error);
        });
      } catch {
        if (!cancelled) handlersRef.current.onMapError?.();
        return;
      }

      if (cancelled || !map) {
        map?.remove();
        mapRef.current = null;
        return;
      }

      function mountMarkers() {
        if (cancelled || !map || !maplibreglRef.current) return;
        try {
          syncCircularMarkers(
            map,
            maplibreglRef.current,
            featuresRef.current.features,
            markersRef.current,
            (entityId) => handlersRef.current.onSelect?.(entityId),
          );
          map.resize();
          handlersRef.current.onViewportChange?.(readViewport(map));
        } catch (error) {
          console.error('[ExploreMapCanvas] marker mount failed', error);
          handlersRef.current.onMapError?.();
        }
      }

      function mountGeography() {
        if (cancelled || !map) return;
        try {
          applyGeographyStyle(map, styleRef.current);
          setSelectedStateFilter(map, selectedStateRef.current);
          setHistoryEdgeData(map, historyEdgeCollectionRef.current);
          setHistoryEdgesVisibility(map, historyEdgesEnabledRef.current);
          setSelectedEdgeFilter(map, selectedEdgeRef.current);
          void loadStatePolygonsWithDensity(map, densityLevelsRef.current).catch((error) => {
            console.error('[ExploreMapCanvas] state polygon load failed', error);
          });
          map.resize();
        } catch (error) {
          console.error('[ExploreMapCanvas] geography style failed', error);
        }
      }

      function handleStateClick(event: MapLayerMouseEvent) {
        const postal = event.features?.[0]?.properties?.postalCode;
        if (typeof postal === 'string' && postal.length > 0) {
          handlersRef.current.onStateSelect?.(postal);
        }
      }

      function handleEdgeClick(event: MapLayerMouseEvent) {
        const edgeId = event.features?.[0]?.properties?.edgeId;
        if (typeof edgeId === 'string' && edgeId.length > 0) {
          handlersRef.current.onEdgeSelect?.(edgeId);
        }
      }

      function handleBackgroundClick(event: MapMouseEvent) {
        if (!map || !activateRef.current) return;
        const hitLayers = [
          EXPLORE_STATE_DENSITY_LAYER_ID,
          EXPLORE_HISTORY_EDGES_LAYER_ID,
          EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
        ].filter((id) => map.getLayer(id));
        const hits = hitLayers.length
          ? map.queryRenderedFeatures(event.point, { layers: hitLayers })
          : [];
        if (hits.length > 0) return;
        handlersRef.current.onActivate?.(readViewport(map));
      }

      mountMarkers();
      map.once('load', () => {
        mountGeography();
        if (map.getLayer(EXPLORE_STATE_DENSITY_LAYER_ID)) {
          map.on('click', EXPLORE_STATE_DENSITY_LAYER_ID, handleStateClick);
          map.on('mouseenter', EXPLORE_STATE_DENSITY_LAYER_ID, () => {
            if (map) map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', EXPLORE_STATE_DENSITY_LAYER_ID, () => {
            if (map) map.getCanvas().style.cursor = '';
          });
        }
        if (map.getLayer(EXPLORE_HISTORY_EDGES_LAYER_ID)) {
          map.on('click', EXPLORE_HISTORY_EDGES_LAYER_ID, handleEdgeClick);
          map.on('mouseenter', EXPLORE_HISTORY_EDGES_LAYER_ID, () => {
            if (map) map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', EXPLORE_HISTORY_EDGES_LAYER_ID, () => {
            if (map) map.getCanvas().style.cursor = '';
          });
        }
        map.on('click', handleBackgroundClick);
        map.resize();
      });

      map.on('moveend', () => {
        if (map) handlersRef.current.onViewportChange?.(readViewport(map));
      });

      resizeObserver = new ResizeObserver(() => {
        map?.resize();
      });
      resizeObserver.observe(container);
      resizeTimer = setTimeout(() => {
        mountMarkers();
        map?.resize();
      }, 200);
    })();

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      clearMarkers(markersRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreglRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreglRef.current;
    if (!map || !maplibregl) return;
    syncCircularMarkers(
      map,
      maplibregl,
      featureCollection.features,
      markersRef.current,
      (entityId) => handlersRef.current.onSelect?.(entityId),
    );
  }, [featureCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setSelectedStateFilter(map, selectedState);
  }, [selectedState]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setHistoryEdgeData(map, historyEdgeCollection);
    setHistoryEdgesVisibility(map, historyEdgesEnabled);
    setSelectedEdgeFilter(map, selectedEdge);
  }, [historyEdgeCollection, historyEdgesEnabled, selectedEdge]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    // Parent rebuilds style when density flips; re-apply geography from latest style prop.
    try {
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
      if (map.getSource(EXPLORE_STATE_DENSITY_SOURCE_ID)) {
        map.removeSource(EXPLORE_STATE_DENSITY_SOURCE_ID);
      }
      if (map.getSource('explore-jurisdiction-areas')) map.removeSource('explore-jurisdiction-areas');
      if (map.getSource(EXPLORE_HISTORY_EDGES_SOURCE_ID)) {
        map.removeSource(EXPLORE_HISTORY_EDGES_SOURCE_ID);
      }
      applyGeographyStyle(map, style);
      setSelectedStateFilter(map, selectedStateRef.current);
      setHistoryEdgeData(map, historyEdgeCollectionRef.current);
      setHistoryEdgesVisibility(map, historyEdgesEnabledRef.current);
      setSelectedEdgeFilter(map, selectedEdgeRef.current);
      void loadStatePolygonsWithDensity(map, densityLevelsRef.current).catch((error) => {
        console.error('[ExploreMapCanvas] state polygon reload failed', error);
      });
    } catch (error) {
      console.error('[ExploreMapCanvas] density restyle failed', error);
    }
  }, [style, densityEnabled]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    void loadStatePolygonsWithDensity(map, densityLevels).catch((error) => {
      console.error('[ExploreMapCanvas] density join failed', error);
    });
  }, [densityLevels]);

  return (
    <div
      ref={containerRef}
      className={className ? `bb-explore-map__canvas ${className}` : 'bb-explore-map__canvas'}
      role="application"
      aria-label="United States map of documented Black history records"
      tabIndex={0}
    />
  );
}
