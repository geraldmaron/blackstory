/**
 * Native Explore map screen (MOB-011 spike).
 *
 * WHY A FEATURE COMPONENT, NOT A ROUTE EDIT: the Explore route
 * (`src/app/(tabs)/explore.tsx`) is owned by the navigation bead (MOB-008) and is
 * out of this bead's file ownership. This bead ships `MapScreen` as a
 * self-contained feature component under `src/features/map/` that MOB-012 imports
 * into the Explore route without a route-tree change. It renders the redacted,
 * release-coupled GeoJSON the API serves; it never fetches or holds raw
 * coordinates (see demoMapSource.ts provenance).
 *
 * Rendering: MapLibre Native (`@maplibre/maplibre-react-native`, ADR-020) draws a
 * native GPU map — no WebGL/CSS/SSR concern. The basemap is the dark-archive
 * PMTiles style (mapStyle.ts). Attribution is our own always-visible element
 * (MapAttribution) with MapLibre's built-in attribution/logo disabled.
 *
 * Failure strategy: `loadState` drives a degraded `ErrorState` (MOB-007) for
 * provider outage, corrupt/unsupported range response, and offline cold start —
 * the map view is not mounted in an error state, so a tile failure degrades
 * instead of crashing. In production a wrapper wires MapLibre's
 * onDidFailLoadingMap + connectivity into `classifyMapError` to produce this
 * state; the state is injected here so each mode is deterministically testable.
 */
import { StyleSheet, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { ErrorState } from '@/ui';
import { MapAttribution } from './MapAttribution';
import { buildBasemapStyle, ENTITY_POINT_LAYER_STYLE } from './mapStyle';
import { MAP_BASEMAP_ENABLED, MAP_PMTILES_URL } from './mapConfig';
import { MAP_FAILURE_COPY, type MapLoadState } from './mapLoadState';
import { DEMO_MAP_SOURCE, type MapFeatureCollection } from './demoMapSource';

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
};

// Continental-US default camera bounds [west, south, east, north] (GeoJSON RFC
// order per MapLibre's LngLatBounds). Presence-first national view.
const US_BOUNDS: [number, number, number, number] = [-124.8, 24.4, -66.9, 49.4];

export function MapScreen({
  source = DEMO_MAP_SOURCE,
  loadState = { kind: 'ready' },
  pmtilesUrl = MAP_PMTILES_URL,
  basemapEnabled = MAP_BASEMAP_ENABLED,
  onRetry,
}: MapScreenProps) {
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

  return (
    <View style={styles.container} testID="map-screen">
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={JSON.stringify(style)}
        attribution={false}
        logo={false}
        compass={false}
        testID="maplibre-map"
      >
        <Camera initialViewState={{ bounds: US_BOUNDS }} maxZoom={12} />
        <GeoJSONSource id="entities" data={source as unknown as GeoJSON.GeoJSON}>
          <Layer id="entity-points" type="circle" style={ENTITY_POINT_LAYER_STYLE} />
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
