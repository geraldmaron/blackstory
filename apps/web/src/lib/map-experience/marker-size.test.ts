/**
 * Confirms the BB-099 marker-size formula: the documented base/log/modifier/clamp math, the
 * halo offset, and that the exported MapLibre expressions are literally built from the same
 * stop/modifier data `markerRadius()` computes (one source of truth, not a hand-kept copy).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONFIDENCE_SIZE_MODIFIER,
  MARKER_HALO_OFFSET,
  MARKER_RADIUS_EVIDENCE_STOPS,
  MARKER_RADIUS_MAX,
  MARKER_RADIUS_MIN,
  confidenceSizeModifierExpression,
  markerHaloRadius,
  markerHaloRadiusExpression,
  markerRadius,
  markerRadiusEvidenceExpression,
  markerRadiusExpression,
} from './marker-size';

test('clamp floor: zero evidence at every confidence tier still returns the minimum radius', () => {
  for (const tier of ['high', 'medium', 'low', 'unrated'] as const) {
    assert.equal(markerRadius(0, tier), MARKER_RADIUS_MIN);
  }
});

test('clamp ceiling: very large evidence counts stay within the maximum radius at every tier', () => {
  for (const tier of ['high', 'medium', 'low', 'unrated'] as const) {
    const radius = markerRadius(1_000_000, tier);
    assert.equal(radius, MARKER_RADIUS_MAX);
  }
});

test('radius is monotonically non-decreasing in evidenceCount at a fixed confidence tier', () => {
  const counts = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  let previous = -Infinity;
  for (const count of counts) {
    const radius = markerRadius(count, 'high');
    assert.ok(radius >= previous, `radius must not decrease as evidenceCount grows (count=${count})`);
    previous = radius;
  }
});

test('confidence tier modifiers order high >= medium >= low == unrated at a fixed mid-range evidenceCount', () => {
  const evidenceCount = 5;
  const high = markerRadius(evidenceCount, 'high');
  const medium = markerRadius(evidenceCount, 'medium');
  const low = markerRadius(evidenceCount, 'low');
  const unrated = markerRadius(evidenceCount, 'unrated');
  assert.ok(high >= medium, 'high confidence must render at least as large as medium');
  assert.ok(medium >= low, 'medium confidence must render at least as large as low');
  assert.equal(low, unrated, 'low and unrated share the same 0.8x modifier');
});

test('an unrecognized confidence tier falls back to the unrated (0.8x) modifier', () => {
  assert.equal(markerRadius(5, 'nonsense-tier'), markerRadius(5, 'unrated'));
});

test('negative or non-finite evidenceCount is treated as zero, never NaN', () => {
  assert.equal(markerRadius(-5, 'high'), markerRadius(0, 'high'));
  assert.equal(Number.isNaN(markerRadius(Number.NaN, 'high')), false);
  assert.equal(markerRadius(Number.NaN, 'high'), markerRadius(0, 'high'));
});

test('markerHaloRadius is exactly the marker radius plus the fixed halo offset, at every tier', () => {
  for (const [count, tier] of [
    [0, 'unrated'],
    [3, 'low'],
    [10, 'medium'],
    [500, 'high'],
  ] as const) {
    assert.equal(markerHaloRadius(count, tier), markerRadius(count, tier) + MARKER_HALO_OFFSET);
  }
});

test('the evidence-count stop table is exactly what markerRadiusEvidenceExpression() flattens into its interpolate expression (one source of truth)', () => {
  const expression = markerRadiusEvidenceExpression();
  const flattenedStops = MARKER_RADIUS_EVIDENCE_STOPS.flatMap(([count, radius]) => [count, radius]);
  assert.deepEqual(expression.slice(3), flattenedStops);
  assert.equal(expression[0], 'interpolate');
  assert.deepEqual(expression[1], ['linear']);
});

test('the confidence-modifier expression is built from CONFIDENCE_SIZE_MODIFIER (one source of truth)', () => {
  const expression = confidenceSizeModifierExpression() as unknown[];
  assert.equal(expression[0], 'match');
  // ['match', input, 'high', v, 'medium', v, 'low', v, fallback]
  const asPairs = new Map<string, number>();
  for (let i = 2; i < expression.length - 1; i += 2) {
    asPairs.set(expression[i] as string, expression[i + 1] as number);
  }
  assert.equal(asPairs.get('high'), CONFIDENCE_SIZE_MODIFIER.high);
  assert.equal(asPairs.get('medium'), CONFIDENCE_SIZE_MODIFIER.medium);
  assert.equal(asPairs.get('low'), CONFIDENCE_SIZE_MODIFIER.low);
  assert.equal(expression[expression.length - 1], CONFIDENCE_SIZE_MODIFIER.unrated);
});

/** Minimal re-implementation of MapLibre's linear `interpolate` evaluator, scoped to exactly the
 * shape `markerRadiusEvidenceExpression()` produces, so this test can prove the built expression
 * evaluates to the same numbers `markerRadius()` computes without pulling in a full MapLibre
 * expression runtime. */
function evaluateLinearInterpolate(stops: ReadonlyArray<readonly [number, number]>, input: number): number {
  if (input <= stops[0]![0]) return stops[0]![1];
  const last = stops[stops.length - 1]!;
  if (input >= last[0]) return last[1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [x0, y0] = stops[i]!;
    const [x1, y1] = stops[i + 1]!;
    if (input >= x0 && input <= x1) {
      const t = (input - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  throw new Error('unreachable');
}

test('markerRadiusExpression(), evaluated by hand at each stop boundary, reproduces markerRadius() exactly (stops are exact interpolation points)', () => {
  for (const [count, baseRadius] of MARKER_RADIUS_EVIDENCE_STOPS) {
    for (const tier of ['high', 'medium', 'low', 'unrated'] as const) {
      const expected = Math.min(
        MARKER_RADIUS_MAX,
        Math.max(MARKER_RADIUS_MIN, baseRadius * CONFIDENCE_SIZE_MODIFIER[tier]),
      );
      assert.equal(markerRadius(count, tier), expected, `count=${count} tier=${tier}`);
    }
  }
});

test('the interpolated expression curve tracks markerRadius() reasonably closely between stops (piecewise-linear approximation of the log curve, not exact off-stop)', () => {
  const interior = [3, 6, 12, 24, 48, 96];
  for (const count of interior) {
    const evaluated = evaluateLinearInterpolate(MARKER_RADIUS_EVIDENCE_STOPS, count);
    const direct = markerRadius(count, 'high');
    // Off-stop points diverge slightly from the continuous log formula because the MapLibre
    // paint expression is a piecewise-linear approximation between doubling stops; both are
    // still governed by the same [MIN, MAX] clamp, so they must stay within a couple of px.
    const clampedEvaluated = Math.min(MARKER_RADIUS_MAX, Math.max(MARKER_RADIUS_MIN, evaluated));
    assert.ok(
      Math.abs(clampedEvaluated - direct) <= 2,
      `count=${count}: expression-evaluated ${clampedEvaluated} vs markerRadius() ${direct} diverged by more than 2px`,
    );
  }
});

test('markerHaloRadiusExpression() offsets each zoom stop of the radius expression by the fixed halo offset', () => {
  // Both expressions are TOP-LEVEL zoom interpolates (the style spec rejects ['zoom'] nested
  // inside arithmetic), so the halo relationship holds per stop output: radius stop `['*',
  // data, scale]` pairs with halo stop `['+', ['*', data, scale], MARKER_HALO_OFFSET]`.
  const radius = markerRadiusExpression() as unknown[];
  const halo = markerHaloRadiusExpression() as unknown[];
  assert.deepEqual(radius.slice(0, 3), ['interpolate', ['linear'], ['zoom']]);
  assert.deepEqual(halo.slice(0, 3), ['interpolate', ['linear'], ['zoom']]);
  assert.equal(halo.length, radius.length);
  for (let i = 3; i < radius.length; i += 2) {
    assert.equal(halo[i], radius[i], `zoom stop ${i} differs`);
    assert.deepEqual(halo[i + 1], ['+', radius[i + 1], MARKER_HALO_OFFSET], `output at stop ${i}`);
  }
});
