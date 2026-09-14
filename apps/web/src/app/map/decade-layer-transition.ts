/**
 * Decade-flow morph contract.
 *
 * Presence density fills lerp A→B per state via feature-state (`colorA`, `colorB`, `blend`)
 * driven by requestAnimationFrame — not a dual-buffer opacity wipe. Pins, clusters, and
 * relationship lines keep a true out/in opacity crossfade on incoming buffers.
 *
 * PER-ENTITY MORPH (repo-o56o). A record documented in both the outgoing and incoming decade no
 * longer dissolves and reappears. The dual buffer stays — it is what lets arriving and departing
 * pins overlap — but a record present on both sides is HELD: full opacity on the current buffer,
 * zero on the incoming one, for the whole morph. Only records that actually enter or leave the
 * decade animate.
 *
 * The old behavior was not merely redundant, it was visible. The two buffers each carried the
 * same pin at `rest * (1 - t)` and `rest * t`, which sums to `rest` arithmetically but does not
 * composite that way: two 50% circles stack to 75%, not 100%. So every persisting pin dipped and
 * its stroke double-drew through the middle of the dissolve, which read as the whole field
 * shimmering when the decade advanced rather than as history moving past records that stay put.
 *
 * MapLibre paint transitions stay at 0; the rAF loop owns the clock so decade advances
 * never snap. Reduced motion collapses to a cut.
 */
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import {
  ENTITY_CLUSTER_OPACITY,
  ENTITY_HALO_OPACITY,
  ENTITY_POINT_FILL_OPACITY,
  ENTITY_PRECISION_RADIUS_OPACITY,
} from './explore-style';
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_PRECISION_RADIUS_LAYER_ID,
  EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
  EXPLORE_ENTITIES_SOURCE_ID,
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
  // No `EXPLORE_PRECISION_RADIUS_*_INCOMING` counterpart exists (unlike halo/point/glyph below):
  // the radius affordance has no dual-buffer partner to crossfade into. Listing it here still
  // fades it out smoothly with everything else rather than leaving a static ring visible while
  // its neighbors dissolve, and `restoreDecadeFadePaintFromStyle` snaps it back to the rebuilt
  // style's (already new-decade) expression at promote, same as every other out-only channel.
  {
    layerId: EXPLORE_PRECISION_RADIUS_LAYER_ID,
    paintKey: 'circle-opacity',
    restOpacity: ENTITY_PRECISION_RADIUS_OPACITY,
  },
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
 *
 * Relationship-line toggles also refuse morph: `configOnly` leaves the primary edge GeoJSON
 * empty until promote, so a lines on/off flip would paint nothing for the dissolve duration
 * (and can strand opacity at 0 if promote is superseded). Snap-apply keeps lines visible.
 */
export function shouldMorphDecadeDataPatch(options: {
  readonly reducedMotion: boolean;
  readonly isInitialApply: boolean;
  readonly layerModeChanged: boolean;
  readonly populationLayerActive?: boolean;
  /** True when Explore `lines` URL/view flag flipped — force a full style/data apply. */
  readonly historyEdgesToggled?: boolean;
}): boolean {
  if (options.layerModeChanged) return false;
  if (options.populationLayerActive) return false;
  if (options.historyEdgesToggled) return false;
  return shouldFadeDecadePatch(options);
}

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

/**
 * Entity ids documented in BOTH decades — the records that must not move while the decade does.
 *
 * Pure and set-based rather than a diff of the feature arrays: order changes between decades for
 * reasons that have nothing to do with membership (the source is rebuilt per decade), so a
 * positional comparison would report churn that is not there.
 */
export function buildDecadeHoldSet(
  currentEntityIds: Iterable<string>,
  nextEntityIds: Iterable<string>,
): ReadonlySet<string> {
  const next = new Set<string>();
  for (const id of nextEntityIds) {
    const trimmed = id.trim();
    if (trimmed) next.add(trimmed);
  }
  const held = new Set<string>();
  for (const id of currentEntityIds) {
    const trimmed = id.trim();
    if (trimmed && next.has(trimmed)) held.add(trimmed);
  }
  return held;
}

/** Entity ids carried by a feature collection, in document order, skipping anything unkeyed. */
export function entityIdsInCollection(collection: {
  readonly features: readonly { readonly properties?: { readonly entityId?: unknown } }[];
}): readonly string[] {
  const ids: string[] = [];
  for (const feature of collection.features) {
    const id = feature.properties?.entityId;
    if (typeof id === 'string' && id.trim()) ids.push(id.trim());
  }
  return ids;
}

/**
 * Opacity paint for one morph channel: held features sit at `heldOpacity`, everything else takes
 * the animated value.
 *
 * A `case` expression rather than per-feature `setFeatureState` on every frame. Feature-state is
 * what density uses, but density is 51 polygons; this runs over the whole pin field, and writing
 * a blend value per pin per frame would be thousands of calls at 60fps. Here the feature-state is
 * written ONCE per transition (a boolean, `hold`) and only the scalar inside the expression moves,
 * so a frame costs one `setPaintProperty` per channel exactly as it did before.
 *
 * `['boolean', ..., false]` supplies the default: a cluster has no `entityId` to promote and so no
 * `hold` state, which is correct — a cluster is a different shape in each decade and should animate.
 */
export function decadeHoldOpacityExpression(
  heldOpacity: number,
  animatedOpacity: number,
): readonly unknown[] {
  return ['case', ['boolean', ['feature-state', 'hold'], false], heldOpacity, animatedOpacity];
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

/** Snap current buffer to resting opacities and incoming buffer to 0 (idle after promote). */
export function setDecadeCrossfadeIdleOpacities(map: MapLibreMap): void {
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, target.restOpacity);
  }
  for (const target of DECADE_CROSSFADE_IN_TARGETS) {
    setPaintSafe(map, target.layerId, target.paintKey, 0);
  }
}

/** The two entity buffers feature-state addresses; edges carry no `entityId` to hold by. */
const DECADE_HOLD_SOURCE_IDS = [
  EXPLORE_ENTITIES_SOURCE_ID,
  EXPLORE_ENTITIES_INCOMING_SOURCE_ID,
] as const;

/**
 * Mark the records present in both decades, once, before the morph starts.
 *
 * Written to BOTH buffers because both consult it: the current buffer holds these at rest while
 * everything else fades out, and the incoming buffer holds them at zero so the same record is
 * never drawn twice.
 */
export function applyDecadeHoldFeatureState(
  map: MapLibreMap,
  heldEntityIds: ReadonlySet<string>,
): void {
  for (const sourceId of DECADE_HOLD_SOURCE_IDS) {
    if (!map.getSource(sourceId)) continue;
    for (const id of heldEntityIds) {
      try {
        map.setFeatureState({ source: sourceId, id }, { hold: true });
      } catch (error) {
        console.error(`[decade-hold] setFeatureState ${sourceId}/${id} failed`, error);
      }
    }
  }
}

/**
 * Drop the hold marks after promote, or when a morph is superseded.
 *
 * Must run on every exit, not just the happy one: a stranded `hold` would pin those records at
 * rest through the NEXT decade's dissolve, which is the same shimmer inverted — records that
 * should leave staying lit.
 */
export function clearDecadeHoldFeatureState(
  map: MapLibreMap,
  heldEntityIds: ReadonlySet<string>,
): void {
  for (const sourceId of DECADE_HOLD_SOURCE_IDS) {
    if (!map.getSource(sourceId)) continue;
    for (const id of heldEntityIds) {
      try {
        map.removeFeatureState({ source: sourceId, id }, 'hold');
      } catch (error) {
        console.error(`[decade-hold] removeFeatureState ${sourceId}/${id} failed`, error);
      }
    }
  }
}

/**
 * Apply dual-buffer pin/edge morph opacities at eased progress ∈ [0, 1].
 *
 * With `holdPersistingRecords`, each channel becomes a `case` expression so a record documented in
 * both decades sits still — rest on the current buffer, zero on the incoming one — while records
 * entering and leaving animate around it. Without it the channels stay plain numbers, which is
 * what a first paint, a reduced-motion cut, and every non-decade caller want.
 */
export function setDecadeMorphProgress(
  map: MapLibreMap,
  progress: number,
  options: { readonly holdPersistingRecords?: boolean } = {},
): void {
  const t = Math.min(1, Math.max(0, progress));
  const hold = options.holdPersistingRecords === true;
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    const { outOpacity } = decadeCrossfadeOpacities(t, target.restOpacity);
    setPaintSafe(
      map,
      target.layerId,
      target.paintKey,
      hold ? decadeHoldOpacityExpression(target.restOpacity, outOpacity) : outOpacity,
    );
  }
  for (const target of DECADE_CROSSFADE_IN_TARGETS) {
    const { inOpacity } = decadeCrossfadeOpacities(t, target.restOpacity);
    setPaintSafe(
      map,
      target.layerId,
      target.paintKey,
      hold ? decadeHoldOpacityExpression(0, inOpacity) : inOpacity,
    );
  }
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
  /** Hold records documented in both decades still for the whole morph (repo-o56o). */
  readonly holdPersistingRecords?: boolean;
}): DecadeMorphAnimationHandle {
  const morphOptions = { holdPersistingRecords: options.holdPersistingRecords === true };
  let rafId = 0;
  let canceled = false;
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
  setDecadeMorphProgress(options.map, 0, morphOptions);
  options.onProgress?.(0);

  const start = performance.now();
  const tick = (now: number) => {
    if (canceled || !options.isCurrent()) {
      finish();
      return;
    }
    const linear = Math.min(1, (now - start) / Math.max(1, options.durationMs));
    const eased = easeInOutCubic(linear);
    setDecadeMorphProgress(options.map, eased, morphOptions);
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
      canceled = true;
      finish();
    },
    done,
  };
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
