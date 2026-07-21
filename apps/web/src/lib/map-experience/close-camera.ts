/**
 * Resolves the camera landing target when an explore selected-record card closes.
 *
 * Hierarchy (one geographic tier up from the point framing — never a jump cut to full
 * CONUS when the reader was already in a tighter context):
 *   beyond county → county/locality framing on the pin
 *   state filter → that state's resting frame
 *   state-scale pre-select → inferred state frame
 *   below-state-scale pre-select → restore the stashed viewport exactly
 *   pin / center without a usable pre-select → county framing on the pin
 *   no center or context → CONUS national bounds
 *
 * Pure and maplibre-free so Node unit tests can lock the bounce-back contract.
 */
import { US_CONUS_BOUNDS, findUsStateForPoint } from '@repo/domain/map/geography';
import { CAMERA_COUNTY_ZOOM, type CameraPresetName } from './camera-presets';
import { viewportForState, type ExploreViewport } from './url-state';

/** Pre-select zoom above this means the reader was inside a county — close eases to county. */
export const CLOSE_BEYOND_COUNTY_ZOOM = 7.5;

/**
 * Pre-select zoom at or above this (and at/below the county threshold) means state-scale —
 * close eases to the state frame. Below this is multi-state / national.
 */
export const CLOSE_STATE_SCALE_ZOOM = 4.8;

export type CloseCameraTarget =
  | {
      readonly preset: Extract<CameraPresetName, 'locality' | 'state'>;
      readonly center: readonly [lng: number, lat: number];
      readonly zoom: number;
    }
  | {
      readonly preset: 'national';
      readonly bounds: readonly [west: number, south: number, east: number, north: number];
    };

export type ResolveCloseCameraInput = {
  /** Camera before the point selection flight (or URL viewport when deep-linked). */
  readonly preSelectViewport?: ExploreViewport;
  /** Pin coordinates of the record being closed, when known. */
  readonly entityCenter?: readonly [lng: number, lat: number];
  /** Active `?state=` filter, when set. */
  readonly stateFilter?: string;
};

/**
 * Picks the close-camera landing from pre-select zoom + geographic context.
 */
export function resolveCloseCameraTarget(input: ResolveCloseCameraInput): CloseCameraTarget {
  const preSelect = input.preSelectViewport;
  const zoom = preSelect?.zoom;
  const center = resolveCenter(input);

  // 1. Beyond county → county framing on the pin (or pre-select center).
  if (isBeyondCounty(zoom) && center) {
    return countyTarget(center);
  }

  // 2. Explicit state filter → that state's resting frame.
  const fromFilter = stateTargetForPostal(input.stateFilter);
  if (fromFilter) return fromFilter;

  // 3. State-scale zoom → infer state from the pin / pre-select center.
  if (isStateScale(zoom) && center) {
    const inferred = stateTargetForPoint(center);
    if (inferred) return inferred;
  }

  // 4. Below state-scale with a stashed viewport — restore exactly (no CONUS jump).
  if (preSelect && isBelowStateScale(zoom)) {
    return restoredViewportTarget(preSelect);
  }

  // 5. Pin / center without a usable pre-select — regional framing, not CONUS.
  if (center) {
    return countyTarget(center);
  }

  return { preset: 'national', bounds: US_CONUS_BOUNDS };
}

function isBeyondCounty(zoom: number | undefined): boolean {
  return zoom !== undefined && zoom > CLOSE_BEYOND_COUNTY_ZOOM;
}

function isStateScale(zoom: number | undefined): boolean {
  return zoom !== undefined && zoom >= CLOSE_STATE_SCALE_ZOOM && zoom <= CLOSE_BEYOND_COUNTY_ZOOM;
}

function isBelowStateScale(zoom: number | undefined): boolean {
  return zoom !== undefined && zoom < CLOSE_STATE_SCALE_ZOOM;
}

function countyTarget(center: readonly [lng: number, lat: number]): CloseCameraTarget {
  return { preset: 'locality', center, zoom: CAMERA_COUNTY_ZOOM };
}

function restoredViewportTarget(viewport: ExploreViewport): CloseCameraTarget {
  return {
    preset: 'locality',
    center: [viewport.lng, viewport.lat],
    zoom: viewport.zoom,
  };
}

function stateTargetForPostal(postalCode: string | undefined): CloseCameraTarget | undefined {
  if (!postalCode) return undefined;
  const viewport = viewportForState(postalCode);
  if (!viewport) return undefined;
  return {
    preset: 'state',
    center: [viewport.lng, viewport.lat],
    zoom: viewport.zoom,
  };
}

function stateTargetForPoint(
  center: readonly [lng: number, lat: number],
): CloseCameraTarget | undefined {
  const state = findUsStateForPoint(center[1], center[0]);
  return state ? stateTargetForPostal(state.postalCode) : undefined;
}

function resolveCenter(
  input: ResolveCloseCameraInput,
): readonly [lng: number, lat: number] | undefined {
  if (input.entityCenter) return input.entityCenter;
  if (input.preSelectViewport) {
    return [input.preSelectViewport.lng, input.preSelectViewport.lat];
  }
  return undefined;
}
