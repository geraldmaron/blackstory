import type {
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_COUNTY_CHOROPLETH_LAYER_ID,
  EXPLORE_COUNTY_LABEL_LAYER_ID,
  EXPLORE_COUNTY_LINES_LAYER_ID,
  EXPLORE_COUNTY_LINES_SOURCE_ID,
  EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  SATELLITE_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_SOURCE_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from '../../app/map/explore-layer-ids';
import { buildExploreMapStyle } from '../../app/map/explore-style';
import {
  DECADE_CROSSFADE_IN_TARGETS,
  DECADE_CROSSFADE_OUT_TARGETS,
  isDecadeFadePaintChannel,
} from '../../app/map/decade-layer-transition';
import { syncSingleLayerPaint } from './map-plate-paint';
import type { MapColorScheme } from '../../lib/map-experience/dignity-style';
import type { StageConfig } from './stage-config';

export const SELECTED_FILL_ID = 'explore-state-selected-fill';
export const SELECTED_LINE_ID = 'explore-state-selected-line';

export const GEOGRAPHY_LAYER_IDS = new Set([
  'background',
  SATELLITE_LAYER_ID,
  'plate-landcover',
  'plate-water',
  'plate-boundary-country',
  'plate-place-city',
  'explore-street-casing',
  'explore-street-fill',
  'explore-street-label',
  'explore-state-density-fill',
  EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID,
  EXPLORE_COUNTY_CHOROPLETH_LAYER_ID,
  EXPLORE_COUNTY_LINES_LAYER_ID,
  EXPLORE_COUNTY_LABEL_LAYER_ID,
  'explore-state-bounds-line',
  'explore-state-selected-fill',
  'explore-state-selected-line',
  'explore-jurisdiction-area-fill',
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
]);
/** The entity-marker stack from `buildExploreMapStyle`, in its stacking order: halo beneath
 * point beneath the event glyph ring, clusters above singles, selected ring on top. Incoming
 * dual-buffer layers sit above the current stack and below the selected ring. Added once
 * then paint-refreshed on style rebuild (theme plate stroke, kind shade expressions). */
export const ENTITY_LAYER_IDS = new Set([
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
]);
/** Sources whose real geometry arrives from a lazy client fetch (`loadStatePolygonsWithDensity`,
 * `loadCountyLines`) — their inline style data is an empty placeholder, so a data patch must
 * never `setData` it back over the loaded polygons. */
export const LAZY_GEOGRAPHY_SOURCE_IDS = new Set<string>([
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_STATE_DENSITY_INCOMING_SOURCE_ID,
  EXPLORE_COUNTY_LINES_SOURCE_ID,
]);
/**
 * History edge GeoJSON is owned by `setHistoryEdgeData` / decade incoming staging — the style
 * always ships an empty FeatureCollection placeholder. setData'ing that placeholder on every
 * apply would blank toggled-on relationship lines between sync ticks.
 */
export const EDGE_MANAGED_SOURCE_IDS = new Set<string>([
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_SOURCE_ID,
]);
/** Primary decade sources held steady during dual-buffer crossdissolve (incoming stages the next frame). */
export const DECADE_PRIMARY_DATA_SOURCE_IDS = new Set<string>([
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_HISTORY_EDGES_SOURCE_ID,
]);
/** Channels decade morph holds during dissolve — mid-swap style sync must not touch them. */
export const DECADE_FADE_OMIT_CHANNELS = new Set(
  [...DECADE_CROSSFADE_OUT_TARGETS, ...DECADE_CROSSFADE_IN_TARGETS].map(
    (target) => `${target.layerId}:${target.paintKey}`,
  ),
);
export function syncLayerLayoutVisibility(
  map: MapLibreMap,
  layer: StyleSpecification['layers'][number],
): void {
  if (!('layout' in layer) || !layer.layout || typeof layer.layout !== 'object') return;
  if (!map.getLayer(layer.id)) return;
  const visibility = (layer.layout as { visibility?: string }).visibility;
  if (visibility !== 'visible' && visibility !== 'none') return;
  try {
    map.setLayoutProperty(layer.id, 'visibility', visibility);
  } catch (error) {
    console.error(`[MapStage] setLayoutProperty ${layer.id}.visibility failed`, error);
  }
}
export function applyGeographyStyle(
  map: MapLibreMap,
  style: StyleSpecification,
  options?: {
    readonly recreateEntitiesSource?: boolean;
    /**
     * When true, skip decade-crossfade opacity channels so an in-flight dissolve
     * cannot flash full opacity when setData / paint sync runs.
     */
    readonly preserveDecadeFadeOpacities?: boolean;
    /**
     * Hold primary entities/edges setData during dual-buffer staging so the
     * visible frame stays put while incoming sources receive the next decade.
     */
    readonly deferPrimaryDecadeData?: boolean;
  },
): void {
  const recreateEntities = options?.recreateEntitiesSource === true;
  const paintOmit = options?.preserveDecadeFadeOpacities ? DECADE_FADE_OMIT_CHANNELS : undefined;

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
    if (map.getSource(EXPLORE_ENTITIES_INCOMING_SOURCE_ID)) {
      map.removeSource(EXPLORE_ENTITIES_INCOMING_SOURCE_ID);
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
      // GL circle layers. During dual-buffer crossdissolve, primary decade sources stay put
      // while incoming buffers stage the next frame.
      if (LAZY_GEOGRAPHY_SOURCE_IDS.has(id)) continue;
      if (EDGE_MANAGED_SOURCE_IDS.has(id)) continue;
      if (options?.deferPrimaryDecadeData && DECADE_PRIMARY_DATA_SOURCE_IDS.has(id)) continue;
      if (id === EXPLORE_ENTITIES_INCOMING_SOURCE_ID) {
        continue;
      }
      const data = (source as { data?: unknown }).data;
      if (typeof existing.setData === 'function' && data && typeof data === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
        existing.setData(data as any);
      }
      continue;
    }
    map.addSource(id, source as SourceSpecification);
  }
  // Geography + entity layers stay mounted across decade/data patches (in-place setData +
  // paint/layout sync). Removing them on every apply read as a full map refresh and killed
  // MapLibre opacity transitions. New layers still append beneath the entity stack when the
  // halo anchor already exists.
  const entityAnchor = map.getLayer(EXPLORE_UNCLUSTERED_HALO_LAYER_ID)
    ? EXPLORE_UNCLUSTERED_HALO_LAYER_ID
    : undefined;
  for (const layer of style.layers ?? []) {
    if (GEOGRAPHY_LAYER_IDS.has(layer.id)) {
      if (!map.getLayer(layer.id)) {
        const beforeId = layer.id === 'background' ? undefined : entityAnchor;
        map.addLayer(layer as LayerSpecification, beforeId);
      } else {
        syncSingleLayerPaint(map, layer, paintOmit ? { omitChannels: paintOmit } : undefined);
        syncLayerLayoutVisibility(map, layer);
      }
      continue;
    }
    if (ENTITY_LAYER_IDS.has(layer.id)) {
      if (!map.getLayer(layer.id)) {
        map.addLayer(layer as LayerSpecification);
      } else if ('paint' in layer && layer.paint) {
        // Refresh kind-shade / plate-dependent paint when the style rebuilds (theme toggle,
        // encoding updates). Source geometry still updates via setData above. Decade-fade
        // opacity channels are omitted mid-swap so the crossfade stays continuous.
        for (const [paintKey, paintValue] of Object.entries(layer.paint)) {
          if (paintOmit && isDecadeFadePaintChannel(layer.id, paintKey)) continue;
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
export function setSelectedStateFilter(map: MapLibreMap, postalCode: string | undefined): void {
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
/**
 * Rebuild the plate style from the resting stage config for one color scheme.
 *
 * The server cannot know the reader's theme — it lives in `localStorage` and is stamped onto
 * `<html data-theme>` by the pre-paint bootstrap script — so `loadMapStageBase` necessarily ships
 * ONE scheme's style. Every client-side entry point that needs the plate to match the document
 * (first mount, `data-theme` toggle) rebuilds through here rather than trusting that prop.
 */
export function buildStyleForScheme(
  cfg: StageConfig,
  colorScheme: MapColorScheme,
): StyleSpecification {
  return buildExploreMapStyle({
    featureCollection: cfg.featureCollection,
    jurisdictionAreaFeatures: cfg.jurisdictionAreaFeatures,
    layerMode: cfg.layerMode,
    popGeo: cfg.popGeo,
    historyEdgesEnabled: cfg.historyEdgesEnabled,
    clusteringEnabled: cfg.clusteringEnabled,
    satellite: cfg.satellite,
    colorScheme,
  });
}
