/**
 * Data-driven marker radius for the `/explore` map (BB-099).
 *
 * Formula (design-direction-v3.md "Map visual language (BB-099)", binding contract):
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

export const MARKER_RADIUS_MIN = 6;
export const MARKER_RADIUS_MAX = 16;
export const MARKER_RADIUS_BASE = 6;
export const MARKER_RADIUS_EVIDENCE_COEFFICIENT = 2.2;
/** Halo renders `MARKER_HALO_OFFSET`px larger than its point marker (design-direction-v3.md). */
export const MARKER_HALO_OFFSET = 6;

export const CONFIDENCE_SIZE_MODIFIER: Readonly<Record<'high' | 'medium' | 'low' | 'unrated', number>> = {
  high: 1.0,
  medium: 0.9,
  low: 0.8,
  unrated: 0.8,
};

function confidenceModifierFor(tier: ConfidenceTierLike): number {
  return (
    CONFIDENCE_SIZE_MODIFIER[tier as keyof typeof CONFIDENCE_SIZE_MODIFIER] ?? CONFIDENCE_SIZE_MODIFIER.unrated
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
export function markerHaloRadius(evidenceCount: number, confidenceTier: ConfidenceTierLike): number {
  return markerRadius(evidenceCount, confidenceTier) + MARKER_HALO_OFFSET;
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
export const MARKER_RADIUS_EVIDENCE_STOPS: ReadonlyArray<readonly [evidenceCount: number, radius: number]> = [
  0, 1, 2, 4, 8, 16, 32, 64, 128, 256,
].map((count) => [count, evidenceBaseRadius(count)] as const);

/** MapLibre `interpolate` expression for the pre-modifier evidence-count term, built from
 * `MARKER_RADIUS_EVIDENCE_STOPS`. Missing `evidenceCount` coalesces to `0` (a brand-new,
 * zero-evidence feature still renders at `MARKER_RADIUS_MIN`, never `undefined`/NaN). */
export function markerRadiusEvidenceExpression(): ExpressionSpecification {
  const stops = MARKER_RADIUS_EVIDENCE_STOPS.flatMap(([count, radius]) => [count, radius]);
  return ['interpolate', ['linear'], ['coalesce', ['get', 'evidenceCount'], 0], ...stops] as ExpressionSpecification;
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

/** Full `markerRadius()` formula as a MapLibre expression: evidence interpolation × confidence
 * modifier, clamped to [`MARKER_RADIUS_MIN`, `MARKER_RADIUS_MAX`] reproducing exactly what the
 * pure `markerRadius()` function computes, for use as a `circle-radius` paint value. */
export function markerRadiusExpression(): ExpressionSpecification {
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

/** `markerRadiusExpression()` plus the fixed halo offset, for use as the halo layer's
 * `circle-radius` paint value. */
export function markerHaloRadiusExpression(): ExpressionSpecification {
  return ['+', markerRadiusExpression(), MARKER_HALO_OFFSET] as ExpressionSpecification;
}
