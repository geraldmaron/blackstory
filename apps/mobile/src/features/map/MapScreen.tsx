/**
 * Native Explore map screen. Started as the MOB-011 spike (render, attribution,
 * failure states); MOB-012 grows it into the full Explore map surface WITHOUT
 * changing the redaction/attribution/failure contract it already proved.
 *
 * WHAT MOB-012 ADDS on top of the spike (all backward-compatible, all optional
 * props so the MOB-011 tests keep passing unchanged):
 *  - Native clustering on the GeoJSON source ("aggregates render before points",
 *    ADR-024) — cluster bubbles + an unclustered point layer + a selection
 *    highlight layer. The cluster register stays dignity-safe: a single flat
 *    Copper Pin color, size (not color) varying with count, and NO heatmap layer.
 *  - Named-preset camera control driven imperatively by a one-shot `cameraCommand`
 *    (a `{target, token}` the parent bumps), so a command fires exactly once and
 *    a re-render never re-drives the camera. Reduced motion collapses the move to
 *    an instant jump (duration 0).
 *  - Viewport reporting (`onRegionDidChange` -> `onViewportChange`) so the
 *    synchronized list can follow the map WITHOUT the map following the list.
 *  - Feature press -> `onFeaturePress(entityId)` for leaf points; cluster bubble
 *    press expands the camera (~2 zoom levels, clamped to MAP_MAX_ZOOM) or
 *    delegates to optional `onClusterPress`.
 *
 * Rendering, attribution, and the three degraded failure states are unchanged
 * from MOB-011 (see the failure block below and MapAttribution / mapLoadState).
 * A JS test runner still cannot mount the native GL view, so tile rendering,
 * live clustering, and camera motion remain device/Maestro evidence (ADR-024).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type NativeSyntheticEvent } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type GeoJSONSourceRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { ErrorState, duration } from '@/ui';
import { MapAttribution } from './MapAttribution';
import {
  buildBasemapStyle,
  ENTITY_CLUSTER_LAYER_STYLE,
  ENTITY_CLUSTER_RADIUS_EXPR,
  ENTITY_EVENT_GLYPH_LAYER_STYLE,
  ENTITY_HALO_LAYER_STYLE,
  ENTITY_POINT_LAYER_STYLE,
  ENTITY_SELECTED_LAYER_STYLE,
} from './mapStyle';
import { enrichMapFeatureCollection } from './enrich-map-features';
import { DIGNITY_PALETTE } from './dignity-palette';
import {
  MAP_BASEMAP_ENABLED,
  MAP_GLYPHS_URL,
  MAP_LABEL_TEXT_FONT,
  MAP_PMTILES_URL,
  MAP_VECTOR_TILE_URL,
} from './mapConfig';
import { MAP_FAILURE_COPY, type MapFailureMode, type MapLoadState } from './mapLoadState';
import { DEMO_MAP_SOURCE, type MapFeatureCollection } from './demoMapSource';
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  PRESET_ZOOM,
  US_BOUNDS,
  US_CAMERA_MAX_BOUNDS,
  type Bbox,
  type CameraTarget,
  type LngLat,
} from './mapCamera';
import {
  clusterCenterFromFeature,
  isClusterFeatureProperties,
  zoomAfterClusterExpand,
} from './clusterCamera';

/** MapLibre RN Layer style typing is narrower than valid expression arrays. */
function circleLayerStyle(style: Record<string, unknown>): Record<string, unknown> {
  return style;
}

/** A one-shot camera instruction; `token` must strictly increase so each move fires once. */
export type MapCameraCommand = CameraTarget & { readonly token: number };

export type MapClusterPressInfo = {
  readonly center: LngLat;
  readonly currentZoom: number;
  readonly pointCount?: number;
};

export type MapScreenProps = {
  /** Redacted, release-coupled GeoJSON from apps/api-public. */
  readonly source?: MapFeatureCollection;
  /** Injected load/failure state; defaults to ready. */
  readonly loadState?: MapLoadState;
  /** PMTiles archive URL override (tests / staging). */
  readonly pmtilesUrl?: string | null;
  /** OpenFreeMap / vector TileJSON override (tests / staging). */
  readonly vectorTileUrl?: string | null;
  /** Glyphs template override (tests / staging). */
  readonly glyphsUrl?: string | null;
  /** Basemap kill-switch override (tests). */
  readonly basemapEnabled?: boolean;
  /** Retry callback surfaced by the degraded state. */
  readonly onRetry?: () => void;
  /** Enable native clustering (aggregates render before points). Default true. */
  readonly clustering?: boolean;
  /** Fired when the map viewport settles, so the list can re-filter to what's in view. */
  readonly onViewportChange?: (bbox: Bbox) => void;
  /** Fired when a point (or a resolved cluster leaf) is pressed. */
  readonly onFeaturePress?: (entityId: string) => void;
  /**
   * Optional override for cluster-bubble presses. When omitted, MapScreen expands
   * the camera toward the cluster (~2 zoom levels, clamped to MAP_MAX_ZOOM).
   */
  readonly onClusterPress?: (info: MapClusterPressInfo) => void;
  /** Entity id to visually highlight on the map. */
  readonly selectedEntityId?: string;
  /** One-shot camera move; applied once per new `token`. */
  readonly cameraCommand?: MapCameraCommand | null;
  /** Collapse camera animation to an instant jump (OS reduce-motion). */
  readonly reduceMotion?: boolean;
  /**
   * When false, skips the in-map attribution pill so a parent (Explore) can
   * host it as a sibling under the bottom sheet. Default true (MOB-011).
   */
  readonly showAttribution?: boolean;
  /**
   * When the native map fails to load (WebGL / style / tile engine), surfaces a
   * degraded state. List/metrics chrome stays mounted in Explore (ADR-024 §7).
   */
  readonly onMapEngineFailure?: () => void;
};

function boundsFromEvent(event: NativeSyntheticEvent<ViewStateChangeEvent>): Bbox | null {
  const bounds = event?.nativeEvent?.bounds;
  if (!Array.isArray(bounds) || bounds.length < 4) return null;
  const [west, south, east, north] = bounds;
  if (![west, south, east, north].every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return null;
  }
  return { west, south, east, north };
}

function lngLatFromPress(
  event: NativeSyntheticEvent<{ lngLat?: unknown; features?: GeoJSON.Feature[] }>,
  feature: GeoJSON.Feature,
): LngLat | null {
  const fromFeature = clusterCenterFromFeature(feature);
  if (fromFeature) return fromFeature;
  const lngLat = event?.nativeEvent?.lngLat;
  if (Array.isArray(lngLat) && lngLat.length >= 2) {
    const lng = lngLat[0];
    const lat = lngLat[1];
    if (typeof lng === 'number' && typeof lat === 'number' && Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lng, lat];
    }
  }
  return null;
}

export function MapScreen({
  source = DEMO_MAP_SOURCE,
  loadState = { kind: 'ready' },
  pmtilesUrl = MAP_PMTILES_URL,
  vectorTileUrl = MAP_VECTOR_TILE_URL,
  glyphsUrl = MAP_GLYPHS_URL,
  basemapEnabled = MAP_BASEMAP_ENABLED,
  onRetry,
  clustering = true,
  onViewportChange,
  onFeaturePress,
  onClusterPress,
  selectedEntityId,
  cameraCommand,
  reduceMotion = false,
  showAttribution = true,
  onMapEngineFailure,
}: MapScreenProps) {
  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const appliedTokenRef = useRef<number | null>(null);
  const zoomRef = useRef(PRESET_ZOOM.national);
  const [engineFailed, setEngineFailed] = useState(false);

  const encodedSource = useMemo(() => enrichMapFeatureCollection(source), [source]);

  // Apply a one-shot camera command exactly once per token. Guarded so a mocked
  // (null-ref) map in tests and a missing command are both no-ops.
  useEffect(() => {
    const command = cameraCommand;
    const camera = cameraRef.current;
    if (!command || !camera) return;
    if (appliedTokenRef.current === command.token) return;
    appliedTokenRef.current = command.token;

    const animationDuration = reduceMotion
      ? duration.durationInstant
      : command.kind === 'center'
        ? duration.durationFast
        : duration.durationBase;

    try {
      if (command.kind === 'center') {
        camera.flyTo?.({
          center: [command.center[0], command.center[1]],
          zoom: command.zoom,
          duration: animationDuration,
        });
        zoomRef.current = command.zoom;
      } else {
        const [w, s, e, n] = command.bounds;
        camera.fitBounds?.([w, s, e, n], { duration: animationDuration });
      }
    } catch {
      /* camera not ready yet; the next command (new token) will apply */
    }
  }, [cameraCommand, reduceMotion]);

  if (engineFailed || loadState.kind === 'error') {
    const mode: MapFailureMode = engineFailed
      ? 'map-canvas-unavailable'
      : loadState.kind === 'error'
        ? loadState.mode
        : 'map-canvas-unavailable';
    const copy = MAP_FAILURE_COPY[mode];
    return (
      <View style={styles.errorContainer} testID="map-error-state">
        <ErrorState
          title={copy.title}
          description={copy.description}
          retry={copy.retryable && onRetry ? { label: 'Try again', onPress: onRetry } : undefined}
        />
      </View>
    );
  }

  if (loadState.kind === 'loading') {
    return (
      <View style={styles.errorContainer} testID="map-loading-state">
        <ErrorState
          title="Loading the map"
          description="Fetching the latest release-coupled places. The list will fill in as soon as they arrive."
        />
      </View>
    );
  }

  const style = buildBasemapStyle({
    basemapEnabled,
    pmtilesUrl,
    vectorTileUrl,
    glyphsUrl,
  });

  function expandTowardCluster(center: LngLat): void {
    const camera = cameraRef.current;
    if (!camera) return;
    const nextZoom = zoomAfterClusterExpand(zoomRef.current);
    const animationDuration = reduceMotion ? duration.durationInstant : duration.durationFast;
    try {
      camera.flyTo?.({
        center: [center[0], center[1]],
        zoom: nextZoom,
        duration: animationDuration,
      });
      zoomRef.current = nextZoom;
    } catch {
      /* camera not ready; ignore — next interaction can retry */
    }
  }

  function handleSourcePress(
    event: NativeSyntheticEvent<{
      features?: GeoJSON.Feature[];
      lngLat?: unknown;
    }>,
  ): void {
    const feature = event?.nativeEvent?.features?.[0];
    if (!feature) return;
    const props = (feature.properties ?? {}) as Record<string, unknown>;

    if (isClusterFeatureProperties(props)) {
      const center = lngLatFromPress(event, feature);
      if (!center) return;
      const pointCount =
        typeof props.point_count === 'number' && Number.isFinite(props.point_count)
          ? props.point_count
          : undefined;
      if (onClusterPress) {
        onClusterPress({
          center,
          currentZoom: zoomRef.current,
          ...(pointCount !== undefined ? { pointCount } : {}),
        });
        return;
      }
      expandTowardCluster(center);
      return;
    }

    const entityId = props.entityId;
    if (typeof entityId === 'string' && onFeaturePress) onFeaturePress(entityId);
  }

  function handleRegionDidChange(event: NativeSyntheticEvent<ViewStateChangeEvent>): void {
    const zoom = event?.nativeEvent?.zoom;
    if (typeof zoom === 'number' && Number.isFinite(zoom)) {
      zoomRef.current = zoom;
    }
    if (onViewportChange) {
      const bbox = boundsFromEvent(event);
      if (bbox) onViewportChange(bbox);
    }
  }

  return (
    <View style={styles.container} testID="map-screen">
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={JSON.stringify(style)}
        attribution={false}
        logo={false}
        compass={false}
        onRegionDidChange={handleRegionDidChange}
        onDidFailLoadingMap={() => {
          setEngineFailed(true);
          onMapEngineFailure?.();
        }}
        testID="maplibre-map"
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ bounds: [US_BOUNDS[0], US_BOUNDS[1], US_BOUNDS[2], US_BOUNDS[3]] }}
          minZoom={MAP_MIN_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
          maxBounds={[
            US_CAMERA_MAX_BOUNDS[0],
            US_CAMERA_MAX_BOUNDS[1],
            US_CAMERA_MAX_BOUNDS[2],
            US_CAMERA_MAX_BOUNDS[3],
          ]}
        />
        <GeoJSONSource
          id="entities"
          ref={sourceRef}
          data={encodedSource as unknown as GeoJSON.GeoJSON}
          cluster={clustering}
          clusterRadius={50}
          clusterMaxZoom={MAP_MAX_ZOOM}
          onPress={handleSourcePress}
        >
          {clustering ? (
            <Layer
              id="entity-clusters"
              type="circle"
              filter={['has', 'point_count']}
              style={circleLayerStyle({
                ...ENTITY_CLUSTER_LAYER_STYLE,
                circleRadius: [...ENTITY_CLUSTER_RADIUS_EXPR],
              })}
            />
          ) : null}
          {clustering ? (
            <Layer
              id="entity-cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              style={{
                textField: ['get', 'point_count_abbreviated'],
                textFont: [...MAP_LABEL_TEXT_FONT],
                textSize: 11,
                textColor: DIGNITY_PALETTE.clusterText,
              }}
            />
          ) : null}
          <Layer
            id="entity-halo"
            type="circle"
            filter={clustering ? ['!', ['has', 'point_count']] : undefined}
            style={circleLayerStyle(ENTITY_HALO_LAYER_STYLE as Record<string, unknown>)}
          />
          <Layer
            id="entity-points"
            type="circle"
            filter={clustering ? ['!', ['has', 'point_count']] : undefined}
            style={circleLayerStyle(ENTITY_POINT_LAYER_STYLE as Record<string, unknown>)}
          />
          <Layer
            id="entity-event-glyph"
            type="circle"
            filter={
              clustering
                ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'kind'], 'event']]
                : ['==', ['get', 'kind'], 'event']
            }
            style={circleLayerStyle(ENTITY_EVENT_GLYPH_LAYER_STYLE as Record<string, unknown>)}
          />
          {selectedEntityId ? (
            <Layer
              id="entity-selected"
              type="circle"
              filter={['==', ['get', 'entityId'], selectedEntityId]}
              style={circleLayerStyle(ENTITY_SELECTED_LAYER_STYLE as Record<string, unknown>)}
            />
          ) : null}
        </GeoJSONSource>
      </Map>
      {showAttribution ? <MapAttribution /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorContainer: { flex: 1, justifyContent: 'center' },
});

export { MAP_MAX_ZOOM, MAP_MIN_ZOOM, US_BOUNDS, US_CAMERA_MAX_BOUNDS };
export type { Bbox, CameraTarget, LngLat };
