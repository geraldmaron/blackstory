/**
 * Data-driven marker radius for the `/explore` map ().
 *
 * Formula (design-direction-v3.md "Map visual language ()", binding contract):
 *
 *   radius = clamp(MIN, MAX, (BASE + log2(1 + evidenceCount) * EVIDENCE_COEFFICIENT) * modifier)
 *   modifier = 1.0 high | 0.9 medium | 0.8 low | 0.8 unrated
 *   halo     = radius + HALO_OFFSET
 *
 * `evidenceCount` (an already-public count of accepted claims, see
 * `build-explore-map-source.ts`'s `evidenceCount` doc never a hidden ranking score) is the
 * primary weight; `confidenceTier` is a secondary modifier only, so a single unrated claim can
 * never out-rank a well-evidenced record just for nominally carrying a "higher" tier.
 *
 * Every export below is pure data or a pure function no `maplibre-gl` runtime import, no DOM
 * so this module is usable both by `explore-style.ts`'s MapLibre paint expressions and by any
 * HTML-marker fallback (the same split this repo already uses for `geo-precision.ts`). The
 * `*_STOPS` / `*Expression()` exports exist so the paint expression is *generated from* the same
 * numbers `markerRadius()` computes never a hand-rewritten copy that can drift out of sync.
 */
import type { ExpressionSpecification } from 'maplibre-gl';

export type ConfidenceTierLike = 'high' | 'medium' | 'low' | 'unrated' | (string & {});

export const MARKER_RADIUS_MIN = 4;
export const MARKER_RADIUS_MAX = 11;
export const MARKER_RADIUS_BASE = 4;
export const MARKER_RADIUS_EVIDENCE_COEFFICIENT = 1.6;
/** Halo renders `MARKER_HALO_OFFSET`px larger than its point marker (design-direction-v3.md). */
export const MARKER_HALO_OFFSET = 3;

export const CONFIDENCE_SIZE_MODIFIER: Readonly<
  Record<'high' | 'medium' | 'low' | 'unrated', number>
> = {
  high: 1.0,
  medium: 0.9,
  low: 0.8,
  unrated: 0.8,
};

function confidenceModifierFor(tier: ConfidenceTierLike): number {
  return (
    CONFIDENCE_SIZE_MODIFIER[tier as keyof typeof CONFIDENCE_SIZE_MODIFIER] ??
    CONFIDENCE_SIZE_MODIFIER.unrated
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The pre-modifier, pre-clamp term: `BASE + log2(1 + evidenceCount) * EVIDENCE_COEFFICIENT`.
 * Negative/non-finite `evidenceCount` is treated as `0` (defensive `evidenceCount` is a plain
 * `number` at this boundary, not a validated domain type). */
function evidenceBaseRadius(evidenceCount: number): number {
  const safeCount = Number.isFinite(evidenceCount) ? Math.max(0, evidenceCount) : 0;
  return MARKER_RADIUS_BASE + Math.log2(1 + safeCount) * MARKER_RADIUS_EVIDENCE_COEFFICIENT;
}

/**
 * Marker radius in px for a single feature, clamped to [`MARKER_RADIUS_MIN`, `MARKER_RADIUS_MAX`].
 * See the module doc for the formula and its rationale.
 */
export function markerRadius(evidenceCount: number, confidenceTier: ConfidenceTierLike): number {
  const unclamped = evidenceBaseRadius(evidenceCount) * confidenceModifierFor(confidenceTier);
  return clamp(unclamped, MARKER_RADIUS_MIN, MARKER_RADIUS_MAX);
}

/** `markerRadius()` plus the fixed halo offset. Computed from the already-clamped marker radius
 * (not the raw unclamped term), so a maxed-out marker's halo never implies a bigger record than
 * the clamp itself already communicates. */
export function markerHaloRadius(
  evidenceCount: number,
  confidenceTier: ConfidenceTierLike,
): number {
  return markerRadius(evidenceCount, confidenceTier) + MARKER_HALO_OFFSET;
}

/**
 * County-proportionate zoom scaling (the related workstream). With county hairlines on the canvas from
 * `COUNTY_LINES_MIN_ZOOM` up (see `us-county-lines.ts`), a fixed-px radius reads wrong at both
 * ends: at the national frame a max-evidence marker blots out several counties at once, and at
 * locality zoom the same pixels under-read against the county polygon around them. The
 * data-driven radius (evidence × confidence, clamped) is therefore multiplied by this
 * zoom-keyed factor so a circle keeps a stable visual relationship to the geography behind it.
 * Stops are calibrated against the 20m county asset: at z3.8 (CONUS resting frame) the median
 * county is ~4 px wide → shrink toward aggregate reading; z5.5 is the state frame where the
 * authored px scale was originally tuned → identity; by z9 (locality) a county spans hundreds
 * of px → the marker can afford presence. The neutral midpoint means the pure
 * `markerRadius()` contract above is unchanged — zoom scaling composes on top of it.
 */
export const MARKER_ZOOM_SCALE_STOPS: ReadonlyArray<readonly [zoom: number, scale: number]> = [
  [3, 0.4],
  [5.5, 0.85],
  [9, 1.15],
  [12, 1.25],
];

/** Pure piecewise-linear counterpart of `markerZoomScaleExpression()` — same stops, flat
 * extrapolation beyond either end, exactly like MapLibre's `interpolate`. */
export function markerZoomScale(zoom: number): number {
  const stops = MARKER_ZOOM_SCALE_STOPS;
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (zoom <= first[0]) return first[1];
  if (zoom >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i += 1) {
    const [z1, s1] = stops[i]!;
    const [z0, s0] = stops[i - 1]!;
    if (zoom <= z1) {
      return s0 + ((zoom - z0) / (z1 - z0)) * (s1 - s0);
    }
  }
  return last[1];
}

/** MapLibre `interpolate` expression built from `MARKER_ZOOM_SCALE_STOPS` — the expression IS
 * the stop table, same non-drift construction as `markerRadiusEvidenceExpression()`. */
export function markerZoomScaleExpression(): ExpressionSpecification {
  const stops = MARKER_ZOOM_SCALE_STOPS.flatMap(([zoom, scale]) => [zoom, scale]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;
}

/** Full zoom-aware radius: `markerRadius()` × `markerZoomScale()` — the pure counterpart of
 * what `markerRadiusExpression()` renders. */
export function markerRadiusAtZoom(
  evidenceCount: number,
  confidenceTier: ConfidenceTierLike,
  zoom: number,
): number {
  return markerRadius(evidenceCount, confidenceTier) * markerZoomScale(zoom);
}

/**
 * Representative evidence-count sample points (doublings, plus 0), each paired with the
 * pre-modifier `evidenceBaseRadius()` value at that count. `markerRadiusEvidenceExpression()`
 * below builds a MapLibre `interpolate` expression directly from this array flattened this
 * array *is* the interpolation, not a description of it, so the two can never silently diverge.
 * Values above the last stop are safe: by evidence-count ~23 the pre-modifier term already
 * exceeds `MARKER_RADIUS_MAX` even before the confidence modifier is applied, so the final clamp
 * (not the interpolation's flat extrapolation past its last stop) is what governs large counts.
 */
export const MARKER_RADIUS_EVIDENCE_STOPS: ReadonlyArray<
  readonly [evidenceCount: number, radius: number]
> = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256].map(
  (count) => [count, evidenceBaseRadius(count)] as const,
);

/** MapLibre `interpolate` expression for the pre-modifier evidence-count term, built from
 * `MARKER_RADIUS_EVIDENCE_STOPS`. Missing `evidenceCount` coalesces to `0` (a brand-new,
 * zero-evidence feature still renders at `MARKER_RADIUS_MIN`, never `undefined`/NaN). */
export function markerRadiusEvidenceExpression(): ExpressionSpecification {
  const stops = MARKER_RADIUS_EVIDENCE_STOPS.flatMap(([count, radius]) => [count, radius]);
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', 'evidenceCount'], 0],
    ...stops,
  ] as ExpressionSpecification;
}

/** MapLibre `match` expression for the confidence-tier size modifier, built from
 * `CONFIDENCE_SIZE_MODIFIER` so the expression and the constant table can't drift apart. */
export function confidenceSizeModifierExpression(): ExpressionSpecification {
  return [
    'match',
    ['coalesce', ['get', 'confidenceTier'], 'unrated'],
    'high',
    CONFIDENCE_SIZE_MODIFIER.high,
    'medium',
    CONFIDENCE_SIZE_MODIFIER.medium,
    'low',
    CONFIDENCE_SIZE_MODIFIER.low,
    CONFIDENCE_SIZE_MODIFIER.unrated,
  ] as ExpressionSpecification;
}

/** The zoom-independent data term: evidence interpolation × confidence modifier, clamped to
 * [`MARKER_RADIUS_MIN`, `MARKER_RADIUS_MAX`] — exactly what the pure `markerRadius()` computes. */
function markerDataRadiusExpression(): ExpressionSpecification {
  return [
    'max',
    MARKER_RADIUS_MIN,
    [
      'min',
      MARKER_RADIUS_MAX,
      ['*', markerRadiusEvidenceExpression(), confidenceSizeModifierExpression()],
    ],
  ] as ExpressionSpecification;
}

/** Builds a top-level zoom `interpolate` whose output at each `MARKER_ZOOM_SCALE_STOPS` stop is
 * `build(dataRadius, scale)`. The style spec only permits `['zoom']` as the input of a
 * TOP-LEVEL `interpolate`/`step` in a paint value — `['*', dataExpr, zoomInterpolate]` is
 * rejected at `addLayer` — so the zoom scaling must be the outermost expression, with the
 * data-driven term repeated inside each stop's output. */
function zoomScaledRadiusExpression(
  build: (dataRadius: ExpressionSpecification, scale: number) => unknown,
): ExpressionSpecification {
  const stops = MARKER_ZOOM_SCALE_STOPS.flatMap(([zoom, scale]) => [
    zoom,
    build(markerDataRadiusExpression(), scale),
  ]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;
}

/** Full `markerRadiusAtZoom()` formula as a MapLibre expression: the clamped data radius scaled
 * by the county-proportionate zoom factor, for use as a `circle-radius` paint value. */
export function markerRadiusExpression(): ExpressionSpecification {
  return zoomScaledRadiusExpression((dataRadius, scale) => ['*', dataRadius, scale]);
}

/** `markerRadiusExpression()` plus a fixed pixel offset (halo ring, event glyph ring), built as
 * its own top-level zoom interpolate for the same spec restriction documented above. */
export function markerRadiusPlusExpression(offset: number): ExpressionSpecification {
  return zoomScaledRadiusExpression((dataRadius, scale) => ['+', ['*', dataRadius, scale], offset]);
}

/** `markerRadiusExpression()` plus the fixed halo offset, for use as the halo layer's
 * `circle-radius` paint value. */
export function markerHaloRadiusExpression(): ExpressionSpecification {
  return markerRadiusPlusExpression(MARKER_HALO_OFFSET);
}
