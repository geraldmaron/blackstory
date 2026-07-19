/**
 * Decade-flow dual-buffer crossfade contract: presence fills and the pin stack
 * morph via simultaneous out/in opacity on current + incoming MapLibre layers
 * so geography never empties (no global fade-to-transparent then refill).
 *
 * MapLibre interpolates numeric paint values only — GeoJSON setData snaps
 * feature properties — so decade changes stage the next frame on an incoming
 * buffer at opacity 0, crossdissolve both buffers, then promote incoming data
 * onto the current sources. Memorial names keep their own staggered
 * feature-state fades. Reduced motion collapses to an instant cut.
 */
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import {
  ENTITY_CLUSTER_OPACITY,
  ENTITY_HALO_OPACITY,
  ENTITY_POINT_FILL_OPACITY,
  PLATE_STATE_FILL_OPACITY,
} from './explore-style';
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './explore-layer-ids';

/**
 * Full dual-buffer crossdissolve duration. Sized for a slow ambient read against
 * the ~4.2s hero decade dwell (settled frame remains readable for most of the dwell).
 */
export const DECADE_LAYER_FADE_MS = 1000;

/** Alias — same duration; name stresses crossdissolve (not out→empty→in). */
export const DECADE_CROSSFADE_MS = DECADE_LAYER_FADE_MS;

/** Paint channel owned by the dual-buffer crossfade (opacity only). */
export type DecadeCrossfadePaintTarget = {
  readonly layerId: string;
  readonly paintKey: string;
  /** Resting opacity when this buffer is the visible “current” frame. */
  readonly restOpacity: number;
};

/** Current-buffer channels — fade toward 0 while incoming rises. */
export const DECADE_CROSSFADE_OUT_TARGETS: readonly DecadeCrossfadePaintTarget[] = [
  { layerId: EXPLORE_STATE_DENSITY_LAYER_ID, paintKey: 'fill-opacity', restOpacity: PLATE_STATE_FILL_OPACITY },
  { layerId: EXPLORE_HISTORY_EDGES_LAYER_ID, paintKey: 'line-opacity', restOpacity: 0.9 },
  { layerId: EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID, paintKey: 'line-opacity', restOpacity: 1 },
  { layerId: EXPLORE_UNCLUSTERED_HALO_LAYER_ID, paintKey: 'circle-opacity', restOpacity: ENTITY_HALO_OPACITY },
  {
    layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
    paintKey: 'circle-opacity',
    restOpacity: ENTITY_POINT_FILL_OPACITY,
  },
  { layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID, paintKey: 'circle-stroke-opacity', restOpacity: 0.9 },
  {
    layerId: EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
    paintKey: 'circle-stroke-opacity',
    restOpacity: 0.9,
  },
  { layerId: EXPLORE_CLUSTER_LAYER_ID, paintKey: 'circle-opacity', restOpacity: ENTITY_CLUSTER_OPACITY },
  { layerId: EXPLORE_CLUSTER_COUNT_LAYER_ID, paintKey: 'text-opacity', restOpacity: 1 },
];

/** Incoming-buffer channels — fade from 0 toward rest; stay at 0 when idle. */
export const DECADE_CROSSFADE_IN_TARGETS: readonly DecadeCrossfadePaintTarget[] = [
  {
    layerId: EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID,
    paintKey: 'fill-opacity',
    restOpacity: PLATE_STATE_FILL_OPACITY,
  },
  { layerId: EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID, paintKey: 'line-opacity', restOpacity: 0.9 },
  {
    layerId: EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID,
    paintKey: 'circle-opacity',
    restOpacity: ENTITY_HALO_OPACITY,
  },
  {
    layerId: EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
    paintKey: 'circle-opacity',
    restOpacity: ENTITY_POINT_FILL_OPACITY,
  },
  {
    layerId: EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
    paintKey: 'circle-stroke-opacity',
    restOpacity: 0.9,
  },
  {
    layerId: EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID,
    paintKey: 'circle-stroke-opacity',
    restOpacity: 0.9,
  },
  {
    layerId: EXPLORE_CLUSTER_INCOMING_LAYER_ID,
    paintKey: 'circle-opacity',
    restOpacity: ENTITY_CLUSTER_OPACITY,
  },
  { layerId: EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID, paintKey: 'text-opacity', restOpacity: 1 },
];

/** @deprecated Use DECADE_CROSSFADE_OUT_TARGETS — kept for call-site compatibility during migration. */
export const DECADE_FADE_PAINT_TARGETS: readonly { readonly layerId: string; readonly paintKey: string }[] =
  DECADE_CROSSFADE_OUT_TARGETS.map(({ layerId, paintKey }) => ({ layerId, paintKey }));

const DECADE_CROSSFADE_CHANNEL_KEYS = new Set(
  [...DECADE_CROSSFADE_OUT_TARGETS, ...DECADE_CROSSFADE_IN_TARGETS].map(
    (target) => `${target.layerId}:${target.paintKey}`,
  ),
);

/** True when a paint channel is owned by the decade crossfade (skip mid-dissolve sync). */
export function isDecadeFadePaintChannel(layerId: string, paintKey: string): boolean {
  return DECADE_CROSSFADE_CHANNEL_KEYS.has(`${layerId}:${paintKey}`);
}

/** @deprecated Alias of isDecadeFadePaintChannel. */
export const isDecadeCrossfadePaintChannel = isDecadeFadePaintChannel;

/** True when a decade patch should run the dual-buffer crossfade (not first paint, not reduced motion). */
export function shouldFadeDecadePatch(options: {
  readonly reducedMotion: boolean;
  readonly isInitialApply: boolean;
}): boolean {
  return !options.reducedMotion && !options.isInitialApply;
}

/** @deprecated Alias of shouldFadeDecadePatch. */
export const shouldCrossfadeDecadePatch = shouldFadeDecadePatch;

/** MapLibre transition duration for decade crossfades; `0` under reduced motion (instant cut). */
export function decadeLayerFadeDurationMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : DECADE_LAYER_FADE_MS;
}

/** Pure crossdissolve opacities for one channel at progress ∈ [0, 1]. Plate never goes empty. */
export function decadeCrossfadeOpacities(
  progress: number,
  restOpacity: number,
): { readonly outOpacity: number; readonly inOpacity: number } {
  const t = Math.min(1, Math.max(0, progress));
  return {
    outOpacity: restOpacity * (1 - t),
    inOpacity: restOpacity * t,
  };
}

/** `fill-opacity-transition` style key for a paint property name. */
export function paintTransitionKey(paintKey: string): string {
  return `${paintKey}-transition`;
}

function setPaintSafe(map: MapLibreMap, layerId: string, paintKey: string, value: unknown): void {
  if (!map.getLayer(layerId)) return;
  try {
    map.setPaintProperty(layerId, paintKey, value);
  } catch (error) {
    console.error(`[decade-crossfade] setPaintProperty ${layerId}.${paintKey} failed`, error);
  }
}

/** Configures MapLibre per-property transition duration for both crossfade buffers. */
export function setDecadeCrossfadeTransitions(map: MapLibreMap, durationMs: number): void {
  const transition = { duration: durationMs, delay: 0 };
  for (const target of [...DECADE_CROSSFADE_OUT_TARGETS, ...DECADE_CROSSFADE_IN_TARGETS]) {
    setPaintSafe(map, target.layerId, paintTransitionKey(target.paintKey), transition);
  }
}

/** @deprecated Prefer setDecadeCrossfadeTransitions. */
export const setDecadeFadeTransitions = setDecadeCrossfadeTransitions;

/**
 * Snap current buffer to resting opacities and incoming buffer to 0 (idle after
 * promote, or before a new dissolve starts).
 */
export function setDecadeCrossfadeIdleOpacities(map: MapLibreMap): void {
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, target.restOpacity);
  }
  for (const target of DECADE_CROSSFADE_IN_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, 0);
  }
}

/** Begin simultaneous crossdissolve: current → 0, incoming → rest. */
export function setDecadeCrossfadeDissolveOpacities(map: MapLibreMap): void {
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, 0);
  }
  for (const target of DECADE_CROSSFADE_IN_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, target.restOpacity);
  }
}

/**
 * @deprecated Global wipe — do not use for routine decade advances. Prefer dual-buffer
 * setDecadeCrossfadeDissolveOpacities. Kept only so call sites fail loudly if reintroduced.
 */
export function setDecadeFadeOpacities(map: MapLibreMap, opacity: number): void {
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, opacity);
  }
}

/** @deprecated Incoming uses setDecadeCrossfadeDissolveOpacities. */
export function setDecadeFadeInLiterals(map: MapLibreMap): void {
  setDecadeCrossfadeDissolveOpacities(map);
}

/** Restores current-buffer paint channels from the rebuilt explore style (literals or expressions). */
export function restoreDecadeFadePaintFromStyle(map: MapLibreMap, style: StyleSpecification): void {
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    if (!map.getLayer(target.layerId)) continue;
    const layer = style.layers?.find((entry) => entry.id === target.layerId);
    if (!layer || !('paint' in layer) || !layer.paint || typeof layer.paint !== 'object') {
      setPaintSafe(map, target.layerId, target.paintKey, target.restOpacity);
      continue;
    }
    const paintValue = (layer.paint as Record<string, unknown>)[target.paintKey];
    if (paintValue === undefined) {
      setPaintSafe(map, target.layerId, target.paintKey, target.restOpacity);
      continue;
    }
    setPaintSafe(map, target.layerId, target.paintKey, paintValue);
  }
  for (const target of DECADE_CROSSFADE_IN_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, 0);
  }
}
