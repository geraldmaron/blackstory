/**
 * Corridor arc geometry: two screen points in, one SVG path out.
 *
 * Pure and projection-free. `AnnotationOverlay` owns `map.project()`; this module never sees a
 * longitude, which is what keeps the curve testable in plain Node and keeps the overlay free of
 * geometry maths.
 *
 * The lift is the argument the graphic makes. A straight line between two metros reads as a route
 * somebody drove. An arc reads as a relation between two places, which is what a documented
 * migration stream actually is. The 190px ceiling exists because lift scales with on-screen
 * distance: unclamped, a Houston to Los Angeles corridor at continental zoom bows so far it
 * leaves the viewport and the endpoints stop reading as connected at all.
 *
 * See docs/ui/design-direction-v9-atlas.md §6 and docs/ui/patterns-atlas-instrument.md.
 */

export type ScreenPoint = { readonly x: number; readonly y: number };

export type ArcGeometry = {
  /** SVG path data. A single quadratic bezier, or a bare moveto when the arc is degenerate. */
  readonly d: string;
  /**
   * Upper bound on the drawn length in pixels, for `stroke-dasharray`.
   *
   * This is the control polygon length, not the true arc length. By the convex hull property it
   * is always at least the real curve, and for a draw-on that is the safe direction to be wrong
   * in: a dasharray longer than the path finishes drawing a touch early, a dasharray shorter than
   * the path repeats and shows a visible gap mid-arc. Exact quadratic arc length has a closed
   * form, but it carries three degenerate branches that each return NaN, and a NaN dasharray
   * kills the animation silently.
   */
  readonly length: number;
};

/** Perpendicular bow, as a fraction of the on-screen distance between the endpoints. */
export const ARC_LIFT_RATIO = 0.22;
/** Ceiling on the bow, in pixels. */
export const ARC_LIFT_MAX = 190;

/** Coordinate precision in the emitted path. Sub-pixel detail is invisible and churns the DOM. */
const PATH_PRECISION = 1;

function isFinitePoint(point: ScreenPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function n(value: number): string {
  return value.toFixed(PATH_PRECISION);
}

/** The perpendicular bow for a given chord length, clamped. Exported so the overlay can label it. */
export function arcLift(distance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  return Math.min(distance * ARC_LIFT_RATIO, ARC_LIFT_MAX);
}

export function arcPath(a: ScreenPoint, b: ScreenPoint): ArcGeometry {
  // MapLibre's `project()` returns non-finite coordinates for points behind the horizon on a
  // pitched globe. An empty `d` is valid SVG and renders nothing, which is the honest answer.
  if (!isFinitePoint(a) || !isFinitePoint(b)) return { d: '', length: 0 };

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);

  // Coincident endpoints: two metros landing on the same pixel at low zoom. There is no corridor
  // to draw and the perpendicular is undefined, so emit a moveto rather than divide by zero.
  if (distance === 0) return { d: `M${n(a.x)} ${n(a.y)}`, length: 0 };

  const lift = arcLift(distance);
  // Unit normal to the chord. The sign is fixed, so every corridor bows the same way and a dense
  // field reads as a family of curves instead of noise.
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const controlX = (a.x + b.x) / 2 + normalX * lift;
  const controlY = (a.y + b.y) / 2 + normalY * lift;

  const length =
    Math.hypot(controlX - a.x, controlY - a.y) + Math.hypot(b.x - controlX, b.y - controlY);

  return {
    d: `M${n(a.x)} ${n(a.y)} Q${n(controlX)} ${n(controlY)} ${n(b.x)} ${n(b.y)}`,
    length,
  };
}
