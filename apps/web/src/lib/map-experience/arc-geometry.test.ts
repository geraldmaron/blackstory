/**
 * Arc geometry. Two things here are load-bearing beyond "the curve looks right": the lift clamp,
 * which is what stops a coast-to-coast corridor bowing out of the viewport, and the degenerate
 * guards, because `map.project()` hands back coincident and non-finite points in normal use and a
 * NaN reaching `stroke-dasharray` kills the draw-on with no error anywhere.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ARC_LIFT_MAX, ARC_LIFT_RATIO, arcLift, arcPath } from './arc-geometry';

/** Pulls the three coordinate pairs out of `M x y Q cx cy x2 y2`. */
function parse(d: string): {
  start: [number, number];
  control: [number, number];
  end: [number, number];
} {
  const match = /^M(-?[\d.]+) (-?[\d.]+) Q(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)$/.exec(d);
  assert.ok(match, `not a quadratic path: ${JSON.stringify(d)}`);
  const [, sx, sy, cx, cy, ex, ey] = match;
  return {
    start: [Number(sx), Number(sy)],
    control: [Number(cx), Number(cy)],
    end: [Number(ex), Number(ey)],
  };
}

test('the path starts at a and ends at b', () => {
  const { d } = arcPath({ x: 120, y: 400 }, { x: 640, y: 180 });
  const { start, end } = parse(d);

  assert.deepEqual(start, [120, 400]);
  assert.deepEqual(end, [640, 180]);
});

test('the control point sits perpendicular to the chord, lifted by the ratio', () => {
  const a = { x: 120, y: 400 };
  const b = { x: 640, y: 180 };
  const { control } = parse(arcPath(a, b).d);

  const [midX, midY] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
  const [offsetX, offsetY] = [control[0] - midX, control[1] - midY];
  const [chordX, chordY] = [b.x - a.x, b.y - a.y];

  // Perpendicular: the offset from the midpoint has no component along the chord.
  assert.ok(Math.abs(offsetX * chordX + offsetY * chordY) < 1e-9);
  assert.equal(
    Math.round(Math.hypot(offsetX, offsetY)),
    Math.round(Math.hypot(chordX, chordY) * ARC_LIFT_RATIO),
  );
});

test('lift is clamped at 190px', () => {
  // 2000px apart: the unclamped lift would be 440px. The chord is horizontal, so the whole lift
  // lands on the y axis and the clamp is readable straight off the control point.
  const { control } = parse(arcPath({ x: 0, y: 500 }, { x: 2000, y: 500 }).d);

  assert.equal(Math.abs(control[1] - 500), ARC_LIFT_MAX);
});

test('the clamp actually bites, rather than sitting above every real distance', () => {
  const threshold = ARC_LIFT_MAX / ARC_LIFT_RATIO;

  assert.ok(threshold < 1000, `clamp only engages past ${threshold}px, wider than any viewport`);
  assert.equal(arcLift(threshold - 1), (threshold - 1) * ARC_LIFT_RATIO, 'below: proportional');
  assert.equal(arcLift(threshold + 1), ARC_LIFT_MAX, 'above: clamped');
});

test('handedness is fixed, so the bow follows the direction of travel', () => {
  // Same two places, opposite direction of travel. Because the normal is sign-fixed rather than
  // "always outward", the two bow to opposite sides. That matters for the overlay: origin and
  // destination are not interchangeable, and a reversed corridor should not sit on top of its
  // counterpart.
  const forward = parse(arcPath({ x: 0, y: 0 }, { x: 400, y: 0 }).d);
  const backward = parse(arcPath({ x: 400, y: 0 }, { x: 0, y: 0 }).d);

  assert.equal(forward.control[0], backward.control[0], 'same midpoint');
  assert.equal(forward.control[1], -backward.control[1], 'mirrored across the chord');
  assert.equal(Math.abs(forward.control[1]), 400 * ARC_LIFT_RATIO);
});

test('coincident endpoints render nothing instead of dividing by zero', () => {
  const { d, length } = arcPath({ x: 250, y: 250 }, { x: 250, y: 250 });

  assert.equal(d, 'M250.0 250.0', 'a bare moveto draws no stroke');
  assert.equal(length, 0);
  assert.ok(!d.includes('NaN'));
});

test('non-finite input yields an empty path, never NaN in the path data', () => {
  for (const bad of [
    [
      { x: Number.NaN, y: 10 },
      { x: 20, y: 30 },
    ],
    [
      { x: 10, y: 20 },
      { x: Number.POSITIVE_INFINITY, y: 30 },
    ],
  ] as const) {
    const { d, length } = arcPath(bad[0], bad[1]);
    assert.equal(d, '');
    assert.equal(length, 0);
  }
});

test('length is a safe dasharray: finite, and never shorter than the curve it covers', () => {
  const cases: readonly (readonly [{ x: number; y: number }, { x: number; y: number }])[] = [
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    [
      { x: 120, y: 400 },
      { x: 640, y: 180 },
    ],
    [
      { x: -300, y: 90 },
      { x: 1800, y: 940 },
    ],
  ];

  for (const [a, b] of cases) {
    const { length } = arcPath(a, b);
    const chord = Math.hypot(b.x - a.x, b.y - a.y);

    assert.ok(Number.isFinite(length), 'a NaN dasharray silently cancels the draw-on');
    // The control polygon bounds the curve from above and the chord bounds it from below.
    assert.ok(length >= chord, `${length} must cover at least the chord ${chord}`);
  }
});

test('lift is zero for degenerate distances', () => {
  assert.equal(arcLift(0), 0);
  assert.equal(arcLift(-40), 0);
  assert.equal(arcLift(Number.NaN), 0);
});
