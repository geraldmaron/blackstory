/**
 * Decade-flow layer fade contract: MapLibre paint-property opacity transitions
 * for pins, presence fills, and relationship lines when the ambient decade
 * frame advances or the reader scrubs the timeline. Timing/target helpers plus
 * the setPaintProperty applicators MapStage uses for out→swap→in fades.
 *
 * MapLibre interpolates numeric paint values only (not GeoJSON setData
 * appearance), so decade changes fade the stack out, swap sources, then fade
 * back in. Reduced motion collapses the duration to an instant cut.
 */
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import {
  ENTITY_CLUSTER_OPACITY,
  ENTITY_HALO_OPACITY,
  ENTITY_POINT_FILL_OPACITY,
} from './explore-style';
import {
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './explore-layer-ids';

/** Matches `--ds-duration-slow` / `motion.durationSlow` — readable but short vs. the ~3.6s dwell. */
export const DECADE_LAYER_FADE_MS = 480;

/** Paint channels faded for a decade frame change (opacity only — no glow/shadow chrome). */
export type DecadeFadePaintTarget = {
  readonly layerId: string;
  readonly paintKey: string;
};

export const DECADE_FADE_PAINT_TARGETS: readonly DecadeFadePaintTarget[] = [
  { layerId: EXPLORE_STATE_DENSITY_LAYER_ID, paintKey: 'fill-opacity' },
  { layerId: EXPLORE_HISTORY_EDGES_LAYER_ID, paintKey: 'line-opacity' },
  { layerId: EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID, paintKey: 'line-opacity' },
  { layerId: EXPLORE_UNCLUSTERED_HALO_LAYER_ID, paintKey: 'circle-opacity' },
  { layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID, paintKey: 'circle-opacity' },
  { layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID, paintKey: 'circle-stroke-opacity' },
  { layerId: EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID, paintKey: 'circle-stroke-opacity' },
  { layerId: EXPLORE_CLUSTER_LAYER_ID, paintKey: 'circle-opacity' },
];

/** True when a decade patch should run the out→swap→in fade (not the first paint, not reduced motion). */
export function shouldFadeDecadePatch(options: {
  readonly reducedMotion: boolean;
  readonly isInitialApply: boolean;
}): boolean {
  return !options.reducedMotion && !options.isInitialApply;
}

/** MapLibre transition duration for decade fades; `0` under reduced motion (instant cut). */
export function decadeLayerFadeDurationMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : DECADE_LAYER_FADE_MS;
}

/** `fill-opacity-transition` style key for a paint property name. */
export function paintTransitionKey(paintKey: string): string {
  return `${paintKey}-transition`;
}

/** Configures MapLibre per-property transition duration for decade fade channels. */
export function setDecadeFadeTransitions(map: MapLibreMap, durationMs: number): void {
  const transition = { duration: durationMs, delay: 0 };
  for (const target of DECADE_FADE_PAINT_TARGETS) {
    if (!map.getLayer(target.layerId)) continue;
    try {
      map.setPaintProperty(target.layerId, paintTransitionKey(target.paintKey), transition);
    } catch (error) {
      console.error(
        `[decade-fade] setPaintProperty ${target.layerId}.${paintTransitionKey(target.paintKey)} failed`,
        error,
      );
    }
  }
}

/** Sets every decade-fade opacity channel to a literal (0 = fully faded out). */
export function setDecadeFadeOpacities(map: MapLibreMap, opacity: number): void {
  for (const target of DECADE_FADE_PAINT_TARGETS) {
    if (!map.getLayer(target.layerId)) continue;
    try {
      map.setPaintProperty(target.layerId, target.paintKey, opacity);
    } catch (error) {
      console.error(`[decade-fade] setPaintProperty ${target.layerId}.${target.paintKey} failed`, error);
    }
  }
}

/**
 * Fade-in targets as literals so MapLibre can interpolate 0 → N. Data-driven
 * circle-opacity expressions are restored afterward (duration 0) once the fade completes.
 */
export const DECADE_FADE_IN_LITERALS: readonly (DecadeFadePaintTarget & { readonly value: number })[] = [
  { layerId: EXPLORE_STATE_DENSITY_LAYER_ID, paintKey: 'fill-opacity', value: 1 },
  { layerId: EXPLORE_HISTORY_EDGES_LAYER_ID, paintKey: 'line-opacity', value: 0.9 },
  { layerId: EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID, paintKey: 'line-opacity', value: 1 },
  { layerId: EXPLORE_UNCLUSTERED_HALO_LAYER_ID, paintKey: 'circle-opacity', value: ENTITY_HALO_OPACITY },
  { layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID, paintKey: 'circle-opacity', value: ENTITY_POINT_FILL_OPACITY },
  { layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID, paintKey: 'circle-stroke-opacity', value: 0.9 },
  { layerId: EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID, paintKey: 'circle-stroke-opacity', value: 0.9 },
  { layerId: EXPLORE_CLUSTER_LAYER_ID, paintKey: 'circle-opacity', value: ENTITY_CLUSTER_OPACITY },
];

/** Animates decade-fade channels from 0 toward resting literals (interpolatable). */
export function setDecadeFadeInLiterals(map: MapLibreMap): void {
  for (const target of DECADE_FADE_IN_LITERALS) {
    if (!map.getLayer(target.layerId)) continue;
    try {
      map.setPaintProperty(target.layerId, target.paintKey, target.value);
    } catch (error) {
      console.error(`[decade-fade] fade-in ${target.layerId}.${target.paintKey} failed`, error);
    }
  }
}

/** Restores decade-fade paint channels from the rebuilt explore style (literals or expressions). */
export function restoreDecadeFadePaintFromStyle(map: MapLibreMap, style: StyleSpecification): void {
  for (const target of DECADE_FADE_PAINT_TARGETS) {
    if (!map.getLayer(target.layerId)) continue;
    const layer = style.layers?.find((entry) => entry.id === target.layerId);
    if (!layer || !('paint' in layer) || !layer.paint || typeof layer.paint !== 'object') continue;
    const paintValue = (layer.paint as Record<string, unknown>)[target.paintKey];
    if (paintValue === undefined) continue;
    try {
      map.setPaintProperty(target.layerId, target.paintKey, paintValue);
    } catch (error) {
      console.error(`[decade-fade] restore ${target.layerId}.${target.paintKey} failed`, error);
    }
  }
}
