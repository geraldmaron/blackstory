/**
 * Pure paint-sync helpers for MapStage: layers that survive remove/re-add cycles
 * (background, street stack) need `setPaintProperty` from a rebuilt explore style
 * when the document plate toggles light/dark.
 */
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';

/** Layers that `applyStyleAndData` never removes — paints must be pushed explicitly. */
export const PERSISTENT_PLATE_LAYER_IDS = [
  'background',
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
