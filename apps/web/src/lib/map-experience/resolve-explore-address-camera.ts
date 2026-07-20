/**
 * Maps a `/locate/api?camera=1` resolution onto an explore camera target.
 *
 * Prefers retained lat/lng at locality zoom (neighborhood/campus framing — never street-level
 * rooftop implication; see `CAMERA_COUNTY_ZOOM` / ADR-008). When coordinates were not retained,
 * falls back to the state's shareable viewport (`viewportForState`) from the jurisdiction id.
 * Pure and Node-testable — no MapLibre import.
 */
import { US_STATES } from '@repo/domain/map/geography';
import type { CameraPresetName } from './camera-presets';
import { CAMERA_COUNTY_ZOOM } from './camera-presets';
import { viewportForState, type ExploreViewport } from './url-state';

export type ExploreAddressLocateResolution = {
  readonly match: {
    readonly placeName?: string;
    readonly countyName?: string;
    readonly stateName?: string;
  };
  readonly jurisdictionIds: {
    readonly stateId?: string;
  };
  readonly precision: {
    readonly lat?: number;
    readonly lng?: number;
    readonly exactCoordinatesRetained: boolean;
  };
};

export type ExploreAddressCameraTarget = {
  readonly preset: CameraPresetName;
  readonly viewport: ExploreViewport;
  /** Optional USPS postal code when the match resolved to a known state. */
  readonly statePostalCode?: string;
  /** Short place label for aria-live status (never a raw street address with ZIP). */
  readonly label: string;
};

function postalCodeFromStateId(stateId: string | undefined): string | undefined {
  if (!stateId?.startsWith('us-')) return undefined;
  const fips = stateId.slice(3);
  return US_STATES.find((state) => state.fips === fips)?.postalCode;
}

function buildLabel(resolution: ExploreAddressLocateResolution, statePostalCode?: string): string {
  const parts = [
    resolution.match.placeName,
    resolution.match.countyName,
    resolution.match.stateName,
  ].filter((part): part is string => Boolean(part));
  if (parts.length > 0) return parts.join(', ');
  if (statePostalCode) return statePostalCode;
  return 'Matched place';
}

/**
 * Returns a camera target for explore, or `undefined` when the resolution has neither
 * retained coordinates nor a mappable state jurisdiction.
 */
export function resolveExploreAddressCamera(
  resolution: ExploreAddressLocateResolution,
): ExploreAddressCameraTarget | undefined {
  const statePostalCode = postalCodeFromStateId(resolution.jurisdictionIds.stateId);
  const label = buildLabel(resolution, statePostalCode);
  const { lat, lng, exactCoordinatesRetained } = resolution.precision;

  if (
    exactCoordinatesRetained &&
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return {
      preset: 'locality',
      viewport: { lat, lng, zoom: CAMERA_COUNTY_ZOOM },
      ...(statePostalCode ? { statePostalCode } : {}),
      label,
    };
  }

  if (statePostalCode) {
    const viewport = viewportForState(statePostalCode);
    if (!viewport) return undefined;
    return {
      preset: 'state',
      viewport,
      statePostalCode,
      label,
    };
  }

  return undefined;
}
