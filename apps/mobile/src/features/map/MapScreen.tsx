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
 *  - Feature/cluster press -> `onFeaturePress(entityId)` for the preview sheet.
 *
 * Rendering, attribution, and the three degraded failure states are unchanged
 * from MOB-011 (see the failure block below and MapAttribution / mapLoadState).
 * A JS test runner still cannot mount the native GL view, so tile rendering,
 * live clustering, and camera motion remain device/Maestro evidence (ADR-024).
 */
import { useEffect, useRef } from 'react';
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
import { buildBasemapStyle, ENTITY_POINT_LAYER_STYLE } from './mapStyle';
import { MAP_BASEMAP_ENABLED, MAP_PMTILES_URL } from './mapConfig';
import { MAP_FAILURE_COPY, type MapLoadState } from './mapLoadState';
import { DEMO_MAP_SOURCE, type MapFeatureCollection } from './demoMapSource';
import { MAP_MAX_ZOOM, US_BOUNDS, type Bbox, type CameraTarget, type LngLat } from './mapCamera';

/** A one-shot camera instruction; `token` must strictly increase so each move fires once. */
export type MapCameraCommand = CameraTarget & { readonly token: number };

export type MapScreenProps = {
  /** Redacted, release-coupled GeoJSON from apps/api-public. */
  readonly source?: MapFeatureCollection;
  /** Injected load/failure state; defaults to ready. */
  readonly loadState?: MapLoadState;
  /** PMTiles archive URL override (tests / staging). */
  readonly pmtilesUrl?: string | null;
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
  /** Entity id to visually highlight on the map. */
  readonly selectedEntityId?: string;
  /** One-shot camera move; applied once per new `token`. */
  readonly cameraCommand?: MapCameraCommand | null;
  /** Collapse camera animation to an instant jump (OS reduce-motion). */
  readonly reduceMotion?: boolean;
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

export function MapScreen({
  source = DEMO_MAP_SOURCE,
  loadState = { kind: 'ready' },
  pmtilesUrl = MAP_PMTILES_URL,
  basemapEnabled = MAP_BASEMAP_ENABLED,
  onRetry,
  clustering = true,
  onViewportChange,
  onFeaturePress,
  selectedEntityId,
  cameraCommand,
  reduceMotion = false,
}: MapScreenProps) {
  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const appliedTokenRef = useRef<number | null>(null);

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
      } else {
        const [w, s, e, n] = command.bounds;
        camera.fitBounds?.([w, s, e, n], { duration: animationDuration });
      }
    } catch {
      /* camera not ready yet; the next command (new token) will apply */
    }
  }, [cameraCommand, reduceMotion]);

  if (loadState.kind === 'error') {
    const copy = MAP_FAILURE_COPY[loadState.mode];
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

  const style = buildBasemapStyle({ pmtilesUrl: basemapEnabled ? pmtilesUrl : null });

  function handleSourcePress(event: NativeSyntheticEvent<{ features?: GeoJSON.Feature[] }>): void {
    const feature = event?.nativeEvent?.features?.[0];
    if (!feature) return;
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    // A cluster leaf press resolves to an entity id; a cluster bubble press is
    // handled natively (expansion zoom) — the pure two-interaction model lives in
    // features/explore/clustering.ts and drives the accessible list alternative.
    const entityId = props.entityId;
    if (typeof entityId === 'string' && onFeaturePress) onFeaturePress(entityId);
  }

  return (
    <View style={styles.container} testID="map-screen">
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={JSON.stringify(style)}
        attribution={false}
        logo={false}
        compass={false}
        onRegionDidChange={
          onViewportChange
            ? (event) => {
                const bbox = boundsFromEvent(event);
                if (bbox) onViewportChange(bbox);
              }
            : undefined
        }
        testID="maplibre-map"
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ bounds: [US_BOUNDS[0], US_BOUNDS[1], US_BOUNDS[2], US_BOUNDS[3]] }}
          maxZoom={MAP_MAX_ZOOM}
        />
        <GeoJSONSource
          id="entities"
          ref={sourceRef}
          data={source as unknown as GeoJSON.GeoJSON}
          cluster={clustering}
          clusterRadius={50}
          clusterMaxZoom={MAP_MAX_ZOOM}
          onPress={handleSourcePress}
        >
          {clustering ? (
            // Dignity-safe cluster bubble: a single flat Copper Pin color at a
            // fixed radius — never a density-keyed color ramp or heatmap. Count is
            // conveyed by the separate text label, not by color or a size ramp.
            <Layer
              id="entity-clusters"
              type="circle"
              filter={['has', 'point_count']}
              style={{
                circleColor: ENTITY_POINT_LAYER_STYLE.circleColor,
                circleOpacity: 0.85,
                circleStrokeColor: ENTITY_POINT_LAYER_STYLE.circleStrokeColor,
                circleStrokeWidth: 1,
                circleRadius: 14,
              }}
            />
          ) : null}
          {clustering ? (
            <Layer
              id="entity-cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              style={{
                textField: ['get', 'point_count_abbreviated'],
                textSize: 12,
                textColor: ENTITY_POINT_LAYER_STYLE.circleStrokeColor,
              }}
            />
          ) : null}
          <Layer
            id="entity-points"
            type="circle"
            filter={clustering ? ['!', ['has', 'point_count']] : undefined}
            style={ENTITY_POINT_LAYER_STYLE}
          />
          {selectedEntityId ? (
            <Layer
              id="entity-selected"
              type="circle"
              filter={['==', ['get', 'entityId'], selectedEntityId]}
              style={{
                circleColor: 'transparent',
                circleRadius: 10,
                circleStrokeColor: ENTITY_POINT_LAYER_STYLE.circleStrokeColor,
                circleStrokeWidth: 2.5,
              }}
            />
          ) : null}
        </GeoJSONSource>
      </Map>
      <MapAttribution />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorContainer: { flex: 1, justifyContent: 'center' },
});

export { MAP_MAX_ZOOM, US_BOUNDS };
export type { Bbox, CameraTarget, LngLat };
