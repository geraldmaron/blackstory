/**
 * Pure map camera + viewport geometry (MOB-012, extending MOB-011's map feature).
 *
 * WHY THIS LIVES UNDER `features/map/`, NOT `features/explore/`: camera framing,
 * viewport bounds, and the zoom ceiling are properties of the map surface itself
 * (MOB-011), and MapScreen consumes them directly. Explore orchestration
 * (clustering, filters, list sync) layers on TOP of these in `features/explore/`,
 * so the dependency direction is explore -> map and never the reverse.
 *
 * PRIVACY INVARIANT (inherited from ADR-024 §9/§10 and MOB-011's redaction proof):
 * nothing in this module ever synthesizes a coordinate more precise than the
 * already-redacted input it was handed. `cameraForPreset` clamps every zoom to
 * `MAP_MAX_ZOOM` so no interaction can imply a precision the redacted artifact
 * does not carry, and `boundsForFeatures` only ever returns the min/max envelope
 * of coordinates it is given — it never interpolates a new point. See
 * `coordinateDecimals`/`isNoMorePreciseThan` for the checkable form of this.
 */
import { duration, easingStandardBezier } from '@/ui';

/** Longitude/latitude pair in GeoJSON order. */
export type LngLat = readonly [lng: number, lat: number];

/**
 * A viewport rectangle in degrees. `[west, south, east, north]` is the MapLibre
 * `LngLatBounds` order; this struct form is used for readable membership tests.
 */
export type Bbox = {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
};

/**
 * Hard zoom ceiling for the Explore map. Mirrors `MapScreen`'s `maxZoom={12}`.
 * This is a DIGNITY/PRIVACY control, not only a performance one: the redacted
 * artifact tops out at city/neighborhood precision, so letting a user zoom past
 * this would imply a spatial precision the data does not actually have. Every
 * camera target is clamped to it.
 */
export const MAP_MAX_ZOOM = 12;

/** Continental-US default camera bounds `[west, south, east, north]`. */
export const US_BOUNDS: readonly [number, number, number, number] = [-124.8, 24.4, -66.9, 49.4];

export const US_BBOX: Bbox = { west: -124.8, south: 24.4, east: -66.9, north: 49.4 };

/**
 * Floor zoom so the camera cannot pull back to a free-world view that maxBounds
 * alone (center-clamp) would still allow. Mirrors the national preset (~3.2).
 */
export const MAP_MIN_ZOOM = 3;

/**
 * Degrees of padding beyond `US_BOUNDS` for `Camera.maxBounds`. MapLibre clamps
 * the *center* inside maxBounds; a small pad keeps CONUS framing usable without
 * allowing free pan into distant ocean / Mexico.
 */
export const US_CAMERA_BOUNDS_PAD_DEG = 1.2;

/**
 * Expands a `[west, south, east, north]` envelope by `padDeg` on each side.
 * Pure helper — never invents a coordinate that is not a padded corner of input.
 */
export function padBounds(
  bounds: readonly [number, number, number, number],
  padDeg: number,
): readonly [number, number, number, number] {
  const pad = Number.isFinite(padDeg) ? Math.max(0, padDeg) : 0;
  const [west, south, east, north] = bounds;
  return [west - pad, south - pad, east + pad, north + pad];
}

/** CONUS (+ slight pad) envelope passed to MapLibre `Camera.maxBounds`. */
export const US_CAMERA_MAX_BOUNDS: readonly [number, number, number, number] = padBounds(
  US_BOUNDS,
  US_CAMERA_BOUNDS_PAD_DEG,
);

/** True when `lngLat` falls inside `bbox` (inclusive). US-only; antimeridian is not modeled. */
export function isInBounds(lngLat: LngLat, bbox: Bbox): boolean {
  const [lng, lat] = lngLat;
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

/**
 * The tightest `[west, south, east, north]` envelope containing every coordinate.
 * Returns `US_BOUNDS` for an empty input. This never invents a coordinate: the
 * result's corners are always drawn from values present in the input set.
 */
export function boundsForCoordinates(
  coordinates: readonly LngLat[],
): readonly [number, number, number, number] {
  if (coordinates.length === 0) return US_BOUNDS;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of coordinates) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}

// ---------------------------------------------------------------------------
// Named camera presets
// ---------------------------------------------------------------------------

/**
 * The four named camera presets the bead calls for. They are a NAMED contract
 * (not ad hoc zoom numbers scattered through the UI) so motion, reduced-motion,
 * and the zoom ceiling are applied uniformly.
 */
export type CameraPreset = 'national' | 'state' | 'locality' | 'point';

/**
 * Default zoom per preset. All are at or below `MAP_MAX_ZOOM`; `point` sits
 * exactly at the ceiling deliberately — it is the closest the app will ever go,
 * and it still only frames a city/neighborhood-precision dot.
 */
export const PRESET_ZOOM: Record<CameraPreset, number> = {
  national: 3.2,
  state: 6,
  locality: 9,
  point: MAP_MAX_ZOOM,
};

export type CameraTarget =
  | { readonly kind: 'bounds'; readonly bounds: readonly [number, number, number, number] }
  | { readonly kind: 'center'; readonly center: LngLat; readonly zoom: number };

/** Clamps a zoom into `[0, MAP_MAX_ZOOM]` — the enforcement point for the ceiling. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 0;
  return Math.max(0, Math.min(MAP_MAX_ZOOM, zoom));
}

export type CameraForPresetInput = {
  /** The single point a `point` preset frames (its already-redacted coordinate). */
  readonly point?: LngLat;
  /** The coordinates a `state`/`locality` preset should frame. */
  readonly coordinates?: readonly LngLat[];
};

/**
 * Resolves a named preset to a concrete camera target. `national` frames the US;
 * `state`/`locality` frame the envelope of the given coordinates (falling back to
 * the US when none are supplied); `point` centers on the single point at the
 * ceiling zoom. Every returned zoom is clamped to `MAP_MAX_ZOOM` — the privacy
 * ceiling holds no matter what a caller asks for.
 */
export function cameraForPreset(preset: CameraPreset, input: CameraForPresetInput = {}): CameraTarget {
  switch (preset) {
    case 'national':
      return { kind: 'bounds', bounds: US_BOUNDS };
    case 'state':
    case 'locality': {
      const coords = input.coordinates ?? [];
      if (coords.length <= 1) {
        const only = coords[0] ?? input.point;
        if (only) return { kind: 'center', center: only, zoom: clampZoom(PRESET_ZOOM[preset]) };
        return { kind: 'bounds', bounds: US_BOUNDS };
      }
      return { kind: 'bounds', bounds: boundsForCoordinates(coords) };
    }
    case 'point': {
      const center = input.point ?? input.coordinates?.[0];
      if (!center) return { kind: 'bounds', bounds: US_BOUNDS };
      return { kind: 'center', center, zoom: clampZoom(PRESET_ZOOM.point) };
    }
  }
}

// ---------------------------------------------------------------------------
// Motion (reduced-motion-safe)
// ---------------------------------------------------------------------------

export type CameraMotion = {
  /** Animation duration in ms; 0 when reduced motion is requested. */
  readonly durationMs: number;
  /** Cubic-bezier control points for reanimated-style easing. */
  readonly easing: typeof easingStandardBezier;
};

/**
 * Motion for a camera move, driven by the shared duration tokens (MOB-007) so the
 * map cannot drift from the rest of the design system's timing. When
 * `reduceMotion` is true the duration collapses to 0 — the camera JUMPS rather
 * than animating, satisfying the reduced-motion contract (ADR-022 / accessibility
 * gate) without disabling the camera move itself.
 */
export function cameraMotion(preset: CameraPreset, reduceMotion: boolean): CameraMotion {
  if (reduceMotion) return { durationMs: duration.durationInstant, easing: easingStandardBezier };
  const durationMs = preset === 'point' ? duration.durationFast : duration.durationBase;
  return { durationMs, easing: easingStandardBezier };
}

// ---------------------------------------------------------------------------
// Precision guard (de-redaction defense)
// ---------------------------------------------------------------------------

/** Number of decimal places a numeric coordinate component carries. */
export function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(value);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Max decimal precision across a coordinate's lng and lat components. */
export function coordinateDecimals(lngLat: LngLat): number {
  return Math.max(decimalPlaces(lngLat[0]), decimalPlaces(lngLat[1]));
}

/**
 * The precision of the COARSEST coordinate in a set (fewest decimal places).
 * Cluster markers are coarsened to this so an aggregate never reads as more
 * precise than the least-precise thing it summarizes.
 */
export function coarsestDecimals(sources: readonly LngLat[]): number {
  if (sources.length === 0) return 0;
  return Math.min(...sources.map(coordinateDecimals));
}

/**
 * True when `derived` is NO MORE spatially precise than the COARSEST coordinate in
 * `sources`. This is the checkable form of the "no hidden exact location through
 * zoom or radius" invariant: a derived/aggregate point must not carry more decimal
 * precision than the least-precise redacted input it was computed from.
 */
export function isNoMorePreciseThan(derived: LngLat, sources: readonly LngLat[]): boolean {
  if (sources.length === 0) return true;
  return coordinateDecimals(derived) <= coarsestDecimals(sources);
}

/** Rounds a coordinate DOWN to `decimals` places (coarsening only, never sharpening). */
export function coarsenTo(lngLat: LngLat, decimals: number): LngLat {
  const factor = 10 ** Math.max(0, decimals);
  return [Math.round(lngLat[0] * factor) / factor, Math.round(lngLat[1] * factor) / factor];
}
