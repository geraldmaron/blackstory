/**
 * MapLibre entity circle paint expressions for native Explore.
 * Mirrors web `explore-style.ts` unclustered + cluster layers — kind shade,
 * glyph rim signatures, evidence-based radius. No crime-heatmap ramps.
 */
import {
  DEFAULT_KIND_ENCODING,
  KIND_ENCODING_ENTRIES,
  KIND_FAMILY_ENTRIES,
  MAP_SEMANTIC_TONE_ENCODING,
} from './kind-encoding';
import { DIGNITY_PALETTE } from './dignity-palette';
import {
  markerRadiusExpression,
  markerRadiusPlusExpression,
  markerRadiusPlusScaledExpression,
  MARKER_HALO_OFFSET,
  zoomScaledNumericExpression,
} from './marker-size';

type KindGlyphPaintSignature = {
  readonly opacity: number;
  readonly strokeWidth: number;
  readonly strokeColor: string;
};

/** Solid-fill disc opacity — readable on the dark plate while geography still shows through. */
export const ENTITY_POINT_FILL_OPACITY = 0.68;
/** Soft halo under every unclustered point (flat matte wash, not a glow). */
export const ENTITY_HALO_OPACITY = 0.22;
/** Cluster aggregate disc opacity. */
export const ENTITY_CLUSTER_OPACITY = 0.72;
/** Institution "ring" glyph — mostly hollow by design. */
export const ENTITY_RING_FILL_OPACITY = 0.22;
/** Selected orientation ring offset beyond the data radius (web Explore parity). */
export const ENTITY_SELECTED_RADIUS_OFFSET = 6;

const GLYPH_PAINT_SIGNATURE: Readonly<Record<string, KindGlyphPaintSignature>> = {
  circle: {
    opacity: ENTITY_POINT_FILL_OPACITY,
    strokeWidth: 1.5,
    strokeColor: DIGNITY_PALETTE.selected,
  },
  square: {
    opacity: ENTITY_POINT_FILL_OPACITY,
    strokeWidth: 4,
    strokeColor: DIGNITY_PALETTE.selected,
  },
  diamond: {
    opacity: ENTITY_POINT_FILL_OPACITY,
    strokeWidth: 1.5,
    strokeColor: DIGNITY_PALETTE.selected,
  },
  ring: {
    opacity: ENTITY_RING_FILL_OPACITY,
    strokeWidth: 3,
    strokeColor: DIGNITY_PALETTE.kindInstitutionStroke,
  },
};

const DEFAULT_GLYPH_PAINT_SIGNATURE: KindGlyphPaintSignature = GLYPH_PAINT_SIGNATURE.circle!;

function glyphSignatureFor(glyph: string): KindGlyphPaintSignature {
  return GLYPH_PAINT_SIGNATURE[glyph] ?? DEFAULT_GLYPH_PAINT_SIGNATURE;
}

function kindMatchExpression(
  valueForEntry: (entry: (typeof KIND_ENCODING_ENTRIES)[number][1]) => string | number,
  fallback: string | number,
): readonly unknown[] {
  const cases = KIND_ENCODING_ENTRIES.flatMap(([kind, entry]) => [kind, valueForEntry(entry)]);
  return ['match', ['get', 'kind'], ...cases, fallback] as const;
}

/** Kind-family shade from denormalized `shade` or tone/kind fallbacks. */
export function kindColorExpression(): readonly unknown[] {
  const semanticCases = Object.entries(MAP_SEMANTIC_TONE_ENCODING).flatMap(([tone, entry]) => [
    tone,
    entry.shade,
  ]);
  const kindCases = KIND_FAMILY_ENTRIES.flatMap(([family, entry]) => [family, entry.shade]);
  return [
    'case',
    ['has', 'shade'],
    ['get', 'shade'],
    ['has', 'mapTone'],
    ['match', ['get', 'mapTone'], ...semanticCases, DEFAULT_KIND_ENCODING.shade],
    [
      'match',
      ['coalesce', ['get', 'kindFamily'], ['get', 'kind']],
      ...kindCases,
      DEFAULT_KIND_ENCODING.shade,
    ],
  ] as const;
}

export function kindFillOpacityExpression(): readonly unknown[] {
  return kindMatchExpression(
    (entry) => glyphSignatureFor(entry.glyph).opacity,
    DEFAULT_GLYPH_PAINT_SIGNATURE.opacity,
  );
}

export function kindStrokeWidthExpression(): readonly unknown[] {
  // Zoom-scale rims with the fill disc — fixed px strokes on nationally shrunk fills
  // read as every entity lit/selected.
  return zoomScaledNumericExpression(
    kindMatchExpression(
      (entry) => glyphSignatureFor(entry.glyph).strokeWidth,
      DEFAULT_GLYPH_PAINT_SIGNATURE.strokeWidth,
    ),
  );
}

export function kindStrokeColorExpression(rimColor: string): readonly unknown[] {
  return kindMatchExpression(
    (entry) => (entry.glyph === 'ring' ? DIGNITY_PALETTE.kindInstitutionStroke : rimColor),
    rimColor,
  );
}

export const ENTITY_POINT_LAYER_STYLE = {
  circleColor: kindColorExpression(),
  circleRadius: markerRadiusExpression(),
  circleOpacity: kindFillOpacityExpression(),
  circleStrokeColor: kindStrokeColorExpression(DIGNITY_PALETTE.selected),
  circleStrokeWidth: kindStrokeWidthExpression(),
} as const;

export const ENTITY_HALO_LAYER_STYLE = {
  circleColor: kindColorExpression(),
  circleRadius: markerRadiusPlusExpression(MARKER_HALO_OFFSET),
  circleOpacity: ENTITY_HALO_OPACITY,
  circleStrokeWidth: 0,
} as const;

export const ENTITY_EVENT_GLYPH_LAYER_STYLE = {
  circleColor: kindColorExpression(),
  circleRadius: markerRadiusPlusExpression(4),
  circleOpacity: 0,
  circleStrokeColor: kindColorExpression(),
  circleStrokeWidth: zoomScaledNumericExpression(1.5),
  circleStrokeOpacity: 0.9,
} as const;

/**
 * Selected pin: copper orientation ring (navigational accent) + hollow stroke so
 * selection is never color-alone. Archive Paper stays the default kind rim.
 */
export const ENTITY_SELECTED_LAYER_STYLE = {
  circleColor: 'transparent',
  circleRadius: markerRadiusPlusExpression(ENTITY_SELECTED_RADIUS_OFFSET),
  circleStrokeColor: DIGNITY_PALETTE.selectedAccent,
  circleStrokeWidth: zoomScaledNumericExpression(2.5),
  circleStrokeOpacity: 1,
  circleOpacity: 1,
} as const;

/** Inner paper ring under the copper accent — dual signal on the dark plate. */
export const ENTITY_SELECTED_INNER_LAYER_STYLE = {
  circleColor: 'transparent',
  circleRadius: markerRadiusPlusExpression(3),
  circleStrokeColor: DIGNITY_PALETTE.selected,
  circleStrokeWidth: zoomScaledNumericExpression(1.5),
  circleStrokeOpacity: 0.95,
  circleOpacity: 1,
} as const;

// ---------------------------------------------------------------------------
// Selected pulse ring (docs/ui/patterns-cinematic-map.md §3 "Selection pulse",
// §3 "Reduced motion"). Copper ring, one feature, loops 1.8s ease-in-out
// scaling ~1x -> ~2.1x while fading 0.9 -> 0.12. Reduced motion replaces the
// loop with a single static enlarged ring (opacity ~0.85, scale ~1.35) — see
// `MapScreen.tsx`'s `SelectedPulseRing`, which drives `progress` via
// requestAnimationFrame (animated) or a fixed value (reduced motion) and
// re-renders ONLY this one always-mounted layer, never the source.
// ---------------------------------------------------------------------------

/** One full pulse loop, ease-in-out (spec §3). */
export const ENTITY_SELECTED_PULSE_DURATION_MS = 1800;
/** Ring scale at the start (`progress === 0`) of the loop. */
export const ENTITY_SELECTED_PULSE_SCALE_FROM = 1;
/** Ring scale at the end (`progress === 1`) of the loop — spec's "~2.1". */
export const ENTITY_SELECTED_PULSE_SCALE_TO = 2.1;
/** Stroke opacity at the start of the loop — spec's "0.9". */
export const ENTITY_SELECTED_PULSE_OPACITY_FROM = 0.9;
/** Stroke opacity at the end of the loop — spec's "0.12". */
export const ENTITY_SELECTED_PULSE_OPACITY_TO = 0.12;
/** Reduced-motion static ring scale — spec's "~1.35". */
export const ENTITY_SELECTED_PULSE_STATIC_SCALE = 1.35;
/** Reduced-motion static ring opacity — spec's "~0.85". */
export const ENTITY_SELECTED_PULSE_STATIC_OPACITY = 0.85;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Cosine ease-in-out over `[0, 1]`; symmetric acceleration in and out. */
export function pulseEaseInOut(progress: number): number {
  const clamped = clamp01(progress);
  return (1 - Math.cos(clamped * Math.PI)) / 2;
}

function lerp(from: number, to: number, eased: number): number {
  return from + (to - from) * eased;
}

/**
 * Selected pulse ring paint for one animation frame. `progress` is `[0, 1]`
 * within the loop; the caller (`MapScreen`'s `SelectedPulseRing`) is the only
 * thing that ticks it, so this stays a pure function of one number — no
 * timers, no React, easy to unit test at fixed progress values.
 */
export function entitySelectedPulseLayerStyle(progress: number): Record<string, unknown> {
  const eased = pulseEaseInOut(progress);
  const scale = lerp(ENTITY_SELECTED_PULSE_SCALE_FROM, ENTITY_SELECTED_PULSE_SCALE_TO, eased);
  const opacity = lerp(ENTITY_SELECTED_PULSE_OPACITY_FROM, ENTITY_SELECTED_PULSE_OPACITY_TO, eased);
  return {
    circleColor: 'transparent',
    // `scale` is baked into the zoom interpolate's stops (not multiplied onto
    // the finished expression) — MapLibre requires `["zoom"]` to be read only
    // by a TOP-LEVEL interpolate/step; wrapping the whole zoom expression in
    // an outer `['*', ...]` throws at runtime. See `markerRadiusPlusScaledExpression`.
    circleRadius: markerRadiusPlusScaledExpression(ENTITY_SELECTED_RADIUS_OFFSET, scale),
    circleStrokeColor: DIGNITY_PALETTE.selectedAccent,
    circleStrokeWidth: zoomScaledNumericExpression(2),
    circleStrokeOpacity: opacity,
    circleOpacity: 0,
  } as const;
}

/** Reduced-motion static ring: no timer, fixed enlarged scale + opacity. */
export function entitySelectedPulseStaticLayerStyle(): Record<string, unknown> {
  return {
    circleColor: 'transparent',
    circleRadius: markerRadiusPlusScaledExpression(
      ENTITY_SELECTED_RADIUS_OFFSET,
      ENTITY_SELECTED_PULSE_STATIC_SCALE,
    ),
    circleStrokeColor: DIGNITY_PALETTE.selectedAccent,
    circleStrokeWidth: zoomScaledNumericExpression(2),
    circleStrokeOpacity: ENTITY_SELECTED_PULSE_STATIC_OPACITY,
    circleOpacity: 0,
  } as const;
}

export const ENTITY_CLUSTER_LAYER_STYLE = {
  circleColor: DIGNITY_PALETTE.point,
  circleOpacity: ENTITY_CLUSTER_OPACITY,
  circleStrokeColor: DIGNITY_PALETTE.selected,
  circleStrokeWidth: zoomScaledNumericExpression(2),
} as const;
