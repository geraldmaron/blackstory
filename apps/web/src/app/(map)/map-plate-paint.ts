/**
 * Pure paint-sync helpers for MapStage: layers that survive remove/re-add cycles
 * (background, street stack) need `setPaintProperty` from a rebuilt explore style
 * when the document plate toggles light/dark.
 */
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { plateForScheme, type MapColorScheme } from '../../lib/map-experience/dignity-style';

/**
 * The frame MapLibre paints between `new Map()` and the first `applyGeographyStyle`.
 *
 * It is the ocean plate for the scheme the DOCUMENT is actually in. A fixed dark literal here
 * flashed a near-black plate at every light-theme reader, and because nothing else re-resolved
 * the plate at mount it could stay black until some later data patch happened to rebuild the
 * style — a light `/explore` reading as a solid black map with only state labels on it.
 */
export function buildArchiveBaseStyle(colorScheme: MapColorScheme): StyleSpecification {
  return {
    version: 8,
    name: 'BlackStory — Archive (US)',
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': plateForScheme(colorScheme).ocean },
      },
    ],
  };
}

/** Layers that `applyStyleAndData` never removes — paints must be pushed explicitly. */
export const PERSISTENT_PLATE_LAYER_IDS = [
  'background',
  // Imagery carries per-scheme raster paint (opacity, saturation, brightness bounds) — a theme
  // toggle has to re-push it, or the dark plate's scrim stays over the light one.
  'plate-satellite',
  // Base cartography: land, water, country border and city names all carry theme-dependent
  // paint, so a light/dark toggle has to push their colours the same way it pushes the streets'.
  'plate-landcover',
  'plate-water',
  'plate-boundary-country',
  'plate-place-city',
  'explore-street-casing',
  'explore-street-fill',
  'explore-street-label',
] as const;

export type LayerPaintUpdate = {
  readonly layerId: string;
  readonly paintKey: string;
  readonly paintValue: unknown;
};

function layerIdSet(layerIds: ReadonlySet<string> | readonly string[]): ReadonlySet<string> {
  return layerIds instanceof Set ? layerIds : new Set(layerIds);
}

/** Collects paint key/value pairs from a style spec for the requested layer ids. */
export function collectLayerPaintUpdates(
  style: StyleSpecification,
  layerIds: ReadonlySet<string> | readonly string[],
): readonly LayerPaintUpdate[] {
  const idSet = layerIdSet(layerIds);
  const updates: LayerPaintUpdate[] = [];
  for (const layer of style.layers ?? []) {
    if (!idSet.has(layer.id)) continue;
    if (!('paint' in layer) || !layer.paint || typeof layer.paint !== 'object') continue;
    for (const [paintKey, paintValue] of Object.entries(layer.paint)) {
      updates.push({ layerId: layer.id, paintKey, paintValue });
    }
  }
  return updates;
}

export function applyLayerPaintUpdates(
  map: MapLibreMap,
  updates: readonly LayerPaintUpdate[],
  onError?: (context: LayerPaintUpdate, error: unknown) => void,
): void {
  for (const update of updates) {
    if (!map.getLayer(update.layerId)) continue;
    try {
      map.setPaintProperty(update.layerId, update.paintKey, update.paintValue);
    } catch (error) {
      onError?.(update, error);
    }
  }
}

/** Applies paint from `style` onto live map layers that already exist. */
export function syncLayerPaintFromStyle(
  map: MapLibreMap,
  style: StyleSpecification,
  layerIds: ReadonlySet<string> | readonly string[],
  onError?: (context: LayerPaintUpdate, error: unknown) => void,
): void {
  applyLayerPaintUpdates(map, collectLayerPaintUpdates(style, layerIds), onError);
}

export type SyncSingleLayerPaintOptions = {
  /**
   * Skip these `layerId:paintKey` channels (e.g. decade-fade opacities held at 0
   * during a dual-buffer crossdissolve so mid-dissolve style sync cannot flash full opacity).
   */
  readonly omitChannels?: ReadonlySet<string>;
};

/** Syncs paint for one style layer onto a live map layer when present. */
export function syncSingleLayerPaint(
  map: MapLibreMap,
  layer: StyleSpecification['layers'][number] | undefined,
  options?: SyncSingleLayerPaintOptions,
): void {
  if (!layer || !map.getLayer(layer.id)) return;
  if (!('paint' in layer) || !layer.paint || typeof layer.paint !== 'object') return;
  for (const [paintKey, paintValue] of Object.entries(layer.paint)) {
    if (options?.omitChannels?.has(`${layer.id}:${paintKey}`)) continue;
    try {
      map.setPaintProperty(layer.id, paintKey, paintValue);
    } catch (error) {
      console.error(`[MapStage] setPaintProperty ${layer.id}.${paintKey} failed`, error);
    }
  }
}
