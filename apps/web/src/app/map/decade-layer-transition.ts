/**
 * Decade-flow morph contract.
 *
 * Presence density fills lerp A→B per state via feature-state (`colorA`, `colorB`, `blend`)
 * driven by requestAnimationFrame — not a dual-buffer opacity wipe. Pins, clusters, and
 * relationship lines keep a true out/in opacity crossfade on incoming buffers.
 *
 * MapLibre paint transitions stay at 0; the rAF loop owns the clock so decade advances
 * never snap. Reduced motion collapses to a cut.
 */
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import {
  ENTITY_CLUSTER_OPACITY,
  ENTITY_HALO_OPACITY,
  ENTITY_POINT_FILL_OPACITY,
} from './explore-style';
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_STATE_DENSITY_SOURCE_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './explore-layer-ids';

/**
 * Full dual-buffer morph duration. Sized for a slow ambient read against the
 * ~4.2s hero decade dwell (settled frame remains readable for most of the dwell).
 */
export const DECADE_LAYER_FADE_MS = 1600;

/** Alias — same duration; name stresses crossdissolve (not out→empty→in). */
export const DECADE_CROSSFADE_MS = DECADE_LAYER_FADE_MS;

/** Paint channel owned by the dual-buffer crossfade (opacity only — pins/edges). */
export type DecadeCrossfadePaintTarget = {
  readonly layerId: string;
  readonly paintKey: string;
  /** Resting opacity when this buffer is the visible “current” frame. */
  readonly restOpacity: number;
};

/** Current-buffer channels that fade toward 0 while incoming rises (pins, edges, clusters). */
export const DECADE_CROSSFADE_OUT_TARGETS: readonly DecadeCrossfadePaintTarget[] = [
  { layerId: EXPLORE_HISTORY_EDGES_LAYER_ID, paintKey: 'line-opacity', restOpacity: 0.9 },
  { layerId: EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID, paintKey: 'line-opacity', restOpacity: 1 },
  {
    layerId: EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
    paintKey: 'circle-opacity',
    restOpacity: ENTITY_HALO_OPACITY,
  },
  {
    layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
    paintKey: 'circle-opacity',
    restOpacity: ENTITY_POINT_FILL_OPACITY,
  },
  {
    layerId: EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
    paintKey: 'circle-stroke-opacity',
    restOpacity: 0.9,
  },
  {
    layerId: EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
    paintKey: 'circle-stroke-opacity',
    restOpacity: 0.9,
  },
  {
    layerId: EXPLORE_CLUSTER_LAYER_ID,
    paintKey: 'circle-opacity',
    restOpacity: ENTITY_CLUSTER_OPACITY,
  },
  { layerId: EXPLORE_CLUSTER_COUNT_LAYER_ID, paintKey: 'text-opacity', restOpacity: 1 },
];

/** Incoming-buffer channels — fade from 0 toward rest; stay at 0 when idle. */
export const DECADE_CROSSFADE_IN_TARGETS: readonly DecadeCrossfadePaintTarget[] = [
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
export const DECADE_FADE_PAINT_TARGETS: readonly {
  readonly layerId: string;
  readonly paintKey: string;
}[] = DECADE_CROSSFADE_OUT_TARGETS.map(({ layerId, paintKey }) => ({ layerId, paintKey }));

const ALL_DECADE_MORPH_TARGETS = [
  ...DECADE_CROSSFADE_OUT_TARGETS,
  ...DECADE_CROSSFADE_IN_TARGETS,
] as const;

const DECADE_CROSSFADE_CHANNEL_KEYS = new Set(
  ALL_DECADE_MORPH_TARGETS.map((target) => `${target.layerId}:${target.paintKey}`),
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

/**
 * Decade morph must not run when the map data model changes (`presence` ↔ `blackShare` ↔
 * `blackChange`). Morph uses `configOnly` and never syncs choropleth layout/paint — so a
 * layerMode flip would leave share/change fills invisible or stuck on the previous expression.
 */
export function shouldMorphDecadeDataPatch(options: {
  readonly reducedMotion: boolean;
  readonly isInitialApply: boolean;
  readonly layerModeChanged: boolean;
  readonly populationLayerActive?: boolean;
}): boolean {
  if (options.layerModeChanged) return false;
  if (options.populationLayerActive) return false;
  return shouldFadeDecadePatch(options);
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

/** Smoothstep easing for ambient decade morphs. */
export function easeInOutCubic(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Linear RGB channel lerp for unit tests and non-MapLibre helpers. */
export function lerpHexColor(colorA: string, colorB: string, progress: number): string {
  const parse = (color: string): [number, number, number, number] => {
    const rgba = color.match(
      /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i,
    );
    if (rgba) {
      return [
        Number(rgba[1]),
        Number(rgba[2]),
        Number(rgba[3]),
        rgba[4] !== undefined ? Number(rgba[4]) : 1,
      ];
    }
    const hex = color.replace('#', '');
    if (hex.length === 6) {
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
        1,
      ];
    }
    return [0, 0, 0, 1];
  };
  const t = Math.min(1, Math.max(0, progress));
  const [r1, g1, b1, a1] = parse(colorA);
  const [r2, g2, b2, a2] = parse(colorB);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  const a = a1 + (a2 - a1) * t;
  if (a1 < 1 || a2 < 1 || colorA.includes('rgba') || colorB.includes('rgba')) {
    return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
  }
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export type DensityColorMorphState = {
  readonly fips: string;
  readonly colorA: string;
  readonly colorB: string;
};

type DensityMorphFeature = {
  readonly id?: string;
  readonly properties: { readonly fips?: unknown; readonly fillColor?: unknown };
};

/** Pair each state's current fill with its next-decade target for feature-state lerp. */
export function buildDensityColorMorphStates(
  currentByFips: ReadonlyMap<string, string>,
  features: readonly DensityMorphFeature[],
): readonly DensityColorMorphState[] {
  return features.flatMap((feature) => {
    const fips = String(feature.properties.fips ?? feature.id ?? '');
    if (!fips) return [];
    const colorB = String(feature.properties.fillColor ?? '');
    const colorA = currentByFips.get(fips) ?? colorB;
    return [{ fips, colorA, colorB }];
  });
}

/** Write eased blend progress onto every state polygon (MapLibre interpolates colorA→colorB). */
export function applyDensityBlendProgress(
  map: MapLibreMap,
  states: readonly DensityColorMorphState[],
  easedProgress: number,
  sourceId: string = EXPLORE_STATE_DENSITY_SOURCE_ID,
): void {
  const blend = Math.min(1, Math.max(0, easedProgress));
  for (const state of states) {
    if (!map.getSource(sourceId)) continue;
    try {
      map.setFeatureState(
        { source: sourceId, id: state.fips },
        { colorA: state.colorA, colorB: state.colorB, blend },
      );
    } catch (error) {
      console.error(`[decade-color-morph] setFeatureState ${state.fips} failed`, error);
    }
  }
}

/** Drop feature-state after promote so resting fillColor drives the plate again. */
export function clearDensityMorphFeatureState(
  map: MapLibreMap,
  states: readonly DensityColorMorphState[],
  sourceId: string = EXPLORE_STATE_DENSITY_SOURCE_ID,
): void {
  for (const state of states) {
    if (!map.getSource(sourceId)) continue;
    try {
      map.removeFeatureState({ source: sourceId, id: state.fips });
    } catch (error) {
      console.error(`[decade-color-morph] removeFeatureState ${state.fips} failed`, error);
    }
  }
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

/** Configures MapLibre per-property transition duration for pin/edge crossfade buffers. */
export function setDecadeCrossfadeTransitions(map: MapLibreMap, durationMs: number): void {
  const transition = { duration: durationMs, delay: 0 };
  for (const target of ALL_DECADE_MORPH_TARGETS) {
    setPaintSafe(map, target.layerId, paintTransitionKey(target.paintKey), transition);
  }
}

/** @deprecated Prefer setDecadeCrossfadeTransitions. */
export const setDecadeFadeTransitions = setDecadeCrossfadeTransitions;

/** Snap current buffer to resting opacities and incoming buffer to 0 (idle after promote). */
export function setDecadeCrossfadeIdleOpacities(map: MapLibreMap): void {
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, target.restOpacity);
  }
  for (const target of DECADE_CROSSFADE_IN_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, 0);
  }
}

/** Apply dual-buffer pin/edge morph opacities at eased progress ∈ [0, 1]. */
export function setDecadeMorphProgress(map: MapLibreMap, progress: number): void {
  const t = Math.min(1, Math.max(0, progress));
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    const { outOpacity } = decadeCrossfadeOpacities(t, target.restOpacity);
    setPaintSafe(map, target.layerId, target.paintKey, outOpacity);
  }
  for (const target of DECADE_CROSSFADE_IN_TARGETS) {
    const { inOpacity } = decadeCrossfadeOpacities(t, target.restOpacity);
    setPaintSafe(map, target.layerId, target.paintKey, inOpacity);
  }
}

/**
 * @deprecated Prefer setDecadeMorphProgress via runDecadeMorphAnimation.
 */
export function setDecadeCrossfadeDissolveOpacities(map: MapLibreMap): void {
  setDecadeMorphProgress(map, 1);
}

export type DecadeMorphAnimationHandle = {
  readonly cancel: () => void;
  readonly done: Promise<void>;
};

/**
 * rAF-driven pin/edge morph with optional density color callback.
 * MapLibre paint transitions stay at 0; we own the clock.
 */
export function runDecadeMorphAnimation(options: {
  readonly map: MapLibreMap;
  readonly durationMs: number;
  readonly isCurrent: () => boolean;
  readonly onProgress?: (easedProgress: number) => void;
}): DecadeMorphAnimationHandle {
  let rafId = 0;
  let cancelled = false;
  let settle: (() => void) | undefined;
  const done = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const finish = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    settle?.();
    settle = undefined;
  };

  setDecadeCrossfadeTransitions(options.map, 0);
  setDecadeMorphProgress(options.map, 0);
  options.onProgress?.(0);

  const start = performance.now();
  const tick = (now: number) => {
    if (cancelled || !options.isCurrent()) {
      finish();
      return;
    }
    const linear = Math.min(1, (now - start) / Math.max(1, options.durationMs));
    const eased = easeInOutCubic(linear);
    setDecadeMorphProgress(options.map, eased);
    options.onProgress?.(eased);
    if (linear < 1) {
      rafId = window.requestAnimationFrame(tick);
      return;
    }
    finish();
  };
  rafId = window.requestAnimationFrame(tick);

  return {
    cancel: () => {
      cancelled = true;
      finish();
    },
    done,
  };
}

/**
 * @deprecated Global wipe — do not use for routine decade advances.
 */
export function setDecadeFadeOpacities(map: MapLibreMap, opacity: number): void {
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, opacity);
  }
}

/** @deprecated Incoming uses setDecadeMorphProgress. */
export function setDecadeFadeInLiterals(map: MapLibreMap): void {
  setDecadeMorphProgress(map, 1);
}

/** Restores current-buffer paint channels from the rebuilt explore style (literals or expressions). */
export function restoreDecadeFadePaintFromStyle(map: MapLibreMap, style: StyleSpecification): void {
  for (const target of DECADE_CROSSFADE_IN_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, 0);
  }
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
}

/** @deprecated Density cover dissolve removed — use feature-state color lerp instead. */
export const DECADE_DENSITY_COVER_TARGETS: readonly DecadeCrossfadePaintTarget[] = [];

/** @deprecated Density cover dissolve removed — use feature-state color lerp instead. */
export function decadeDensityCoverOpacities(
  progress: number,
  restOpacity: number,
): { readonly outOpacity: number; readonly inOpacity: number } {
  return { outOpacity: restOpacity, inOpacity: restOpacity * Math.min(1, Math.max(0, progress)) };
}
