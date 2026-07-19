/**
 * Decade-flow layer fade contract: MapLibre paint-property opacity transitions
 * for pins, presence fills, and relationship lines when the ambient decade
 * frame advances or the reader scrubs the timeline. Pure timing/target helpers
 * live here; MapStage applies them via setPaintProperty.
 *
 * MapLibre interpolates numeric paint values only (not GeoJSON setData
 * appearance), so decade changes fade the stack out, swap sources, then fade
 * back in. Reduced motion collapses the duration to an instant cut.
 */
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
