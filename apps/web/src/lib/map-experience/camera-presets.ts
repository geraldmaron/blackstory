/**
 * Cinematic camera grammar for the persistent map stage (ADR-017
 * "Persistent map canvas — one MapLibre instance across hero and explore").
 *
 * Named presets — never raw `flyTo`/`easeTo` defaults — describe each tier of the map's
 * national -> state -> locality -> point descent as motion tokens: `duration`, `curve`,
 * `speed`, an authored slow-out `easing` function, and `padding` (screen-space clearance so a
 * flight's landing point never sits directly under floating chrome). `MapStage`
 * (`apps/web/src/app/(map)/MapStage.tsx`) is the only caller that turns these into real
 * `maplibre-gl` camera calls (`flyPreset`); this module has zero `maplibre-gl` runtime import so
 * it stays unit-testable in plain Node — the same split this repo already uses for
 * `marker-size.ts` / `kind-encoding.ts` / `state-labels.ts`.
 *
 * Design source: design-direction-v3.md "Camera grammar ()" — duration ~2000-2600ms
 * national -> state, ~1600ms state -> locality, ~1200ms -> point; curve ~1.32-1.42; authored
 * slow-out easing (motion that reads as descent into place, never a jump cut); `jumpTo` under
 * reduced motion, full functional parity.
 */

export type CameraPresetName = 'national' | 'state' | 'locality' | 'point';

/** A time-based easing curve: elapsed-time fraction `t` in [0, 1] -> eased-progress fraction in
 * [0, 1]. Shape-compatible with `maplibre-gl`'s `AnimationOptions['easing']`, but this module
 * never imports `maplibre-gl` the type is duplicated in spirit, not by reference. */
export type CameraEasing = (t: number) => number;

export type CameraPreset = {
  /** Flight duration in milliseconds. */
  readonly duration: number;
  /** `flyTo`'s zoom-curve steepness (arc flights only; `easeTo`/`jumpTo` ignore it). */
  readonly curve: number;
  /** `flyTo`'s target average speed (arc flights only). */
  readonly speed: number;
  /** Authored slow-out time easing shared by every preset (see `CAMERA_EASING_SLOW_OUT`). */
  readonly easing: CameraEasing;
  /** Screen-space clearance (px) around the landing target, so floating chrome never occludes
   * it — passed through as `padding` to `flyTo`/`easeTo`/`jumpTo`. */
  readonly padding: number;
};

/**
 * Cubic bezier evaluator (De Casteljau form + Newton-Raphson refinement on the x-solve) — the
 * same construction CSS's `cubic-bezier()` timing functions use. Kept dependency-free rather
 * than reaching for a package; a handful of iterations converges to sub-pixel accuracy, which is
 * more than a camera animation needs.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): CameraEasing {
  function componentAt(a: number, b: number, t: number): number {
    const c = 3 * a;
    const d = 3 * (b - a) - c;
    const e = 1 - c - d;
    return ((e * t + d) * t + c) * t;
  }
  function componentDerivativeAt(a: number, b: number, t: number): number {
    const c = 3 * a;
    const d = 3 * (b - a) - c;
    const e = 1 - c - d;
    return (3 * e * t + 2 * d) * t + c;
  }
  return function easing(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let guess = t;
    for (let i = 0; i < 8; i += 1) {
      const x = componentAt(x1, x2, guess) - t;
      const dx = componentDerivativeAt(x1, x2, guess);
      if (Math.abs(dx) < 1e-6) break;
      guess -= x / dx;
    }
    return componentAt(y1, y2, Math.min(1, Math.max(0, guess)));
  };
}

/** Shared slow-out register for every preset: mirrors `@repo/ui`'s `--ds-easing`
 * (`cubic-bezier(0.16, 1, 0.3, 1)`, `packages/ui/src/tokens/foundation.ts`'s `motion.easingStandard`)
 * so the map's camera register and the rest of the brand's motion register are the same curve —
 * fast departure, long unhurried settle. Motion that reads as descent into place, never a jump
 * cut (design-direction-v3.md "Camera grammar"). */
export const CAMERA_EASING_SLOW_OUT: CameraEasing = cubicBezier(0.16, 1, 0.3, 1);

/** Reduced-motion presets swap in an identity curve; what actually matters is `duration: 0`
 * (`MapStage.flyPreset` never runs a timed animation under reduced motion — it calls `jumpTo`
 * directly and skips `easing`/`curve`/`speed` entirely). This stays a valid `CameraEasing` only
 * so every preset object has a uniform shape. */
const IDENTITY_EASING: CameraEasing = (t) => t;

/**
 * Authored camera grammar. Duration shortens and curve/speed sharpen as the descent gets more
 * specific (national's long establishing arc down to point's quick, tight landing) mirroring
 * the Johnny Harris/Vox register ADR-017 names as the reference: a continuous camera descending
 * into place, never a jump cut.
 */
export const CAMERA_PRESETS: Readonly<Record<CameraPresetName, CameraPreset>> = {
  national: { duration: 2400, curve: 1.36, speed: 0.85, easing: CAMERA_EASING_SLOW_OUT, padding: 64 },
  state: { duration: 2200, curve: 1.35, speed: 0.9, easing: CAMERA_EASING_SLOW_OUT, padding: 48 },
  locality: { duration: 1600, curve: 1.38, speed: 1.0, easing: CAMERA_EASING_SLOW_OUT, padding: 32 },
  point: { duration: 1200, curve: 1.4, speed: 1.1, easing: CAMERA_EASING_SLOW_OUT, padding: 24 },
} as const;

const PRESET_NAMES = Object.keys(CAMERA_PRESETS) as readonly CameraPresetName[];

/** Every preset's `prefers-reduced-motion: reduce` twin: `duration: 0` (an instant jump, never a
 * timed flight), identity easing, `padding` carried over unchanged (padding is landing framing,
 * not motion, so it survives the reduced-motion swap). */
export const REDUCED_MOTION_CAMERA_PRESETS: Readonly<Record<CameraPresetName, CameraPreset>> =
  Object.fromEntries(
    PRESET_NAMES.map((name) => {
      const preset = CAMERA_PRESETS[name];
      const reduced: CameraPreset = { ...preset, duration: 0, easing: IDENTITY_EASING };
      return [name, reduced] as const;
    }),
  ) as Readonly<Record<CameraPresetName, CameraPreset>>;

/** Resolves the preset to actually fly with, honoring reduced motion. Callers that already know
 * `prefersReducedMotion()`'s result (e.g. `MapStage`, which reads it once per flight) should pass
 * it through rather than re-querying `matchMedia`. */
export function cameraPresetFor(name: CameraPresetName, reducedMotion: boolean): CameraPreset {
  return reducedMotion ? REDUCED_MOTION_CAMERA_PRESETS[name] : CAMERA_PRESETS[name];
}

/** Zoom level `MapStage` lands a `point` flight at when arriving on a single entity — a
 * campus/neighborhood-scale framing close enough to read the pin's radius-affordance halo, never
 * a street-level zoom (never implies rooftop precision, and this module has no opinion on
 * any specific coordinate — only on how close the camera gets). */
export const CAMERA_POINT_ZOOM = 13;

/** County / locality resting zoom when a selected-record card closes from beyond-county
 * framing — wide enough to read county hairlines and nearby pins, tighter than `viewportForState`
 * (~6.2). Calibrated against marker-size's z9 locality stop (a county spans hundreds of px). */
export const CAMERA_COUNTY_ZOOM = 9;

/** True when the browser's `prefers-reduced-motion: reduce` media query is active. `false` in
 * any non-DOM environment (SSR, plain-Node tests) never a client-only crash. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
