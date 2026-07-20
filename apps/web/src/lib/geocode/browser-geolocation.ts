/**
 * Thin, dependency-injectable wrapper around the browser's `navigator.geolocation` Web API
 * . This module
 * never calls `getCurrentPosition` on its own it is only ever invoked from
 * `../../components/location/LocationConsentButton.tsx`'s click handler, so the permission
 * prompt (and any real GPS/network location lookup) can only ever follow a deliberate button
 * press, never a page-load effect or any other implicit trigger.
 *
 * Kept separate from the React component specifically so this callback-to-promise adaptation and
 * its error-code mapping are unit-testable against a fake `GeolocationApi` with no DOM/browser
 * environment required (this app's test suite runs under plain `node:test`, no jsdom).
 */

export type BrowserCoordinates = {
  readonly lat: number;
  readonly lng: number;
};

export type GeolocationDenialReason =
  'unsupported' | 'permission_denied' | 'position_unavailable' | 'timeout' | 'unknown_error';

export type GeolocationOutcome =
  | { readonly ok: true; readonly position: BrowserCoordinates }
  | { readonly ok: false; readonly reason: GeolocationDenialReason };

/** Structural subset of the DOM `Geolocation` interface this module actually calls.  */
export type GeolocationApi = {
  getCurrentPosition(
    onSuccess: (position: {
      readonly coords: { readonly latitude: number; readonly longitude: number };
    }) => void,
    onError: (error: { readonly code: number; readonly message: string }) => void,
    options?: PositionOptionsLike,
  ): void;
};

export type PositionOptionsLike = {
  readonly enableHighAccuracy?: boolean;
  readonly timeout?: number;
  readonly maximumAge?: number;
};

const DEFAULT_OPTIONS: PositionOptionsLike = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 0,
};

/** Standard `GeolocationPositionError.code` values (1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT).  */
function reasonForErrorCode(code: number): GeolocationDenialReason {
  if (code === 1) return 'permission_denied';
  if (code === 2) return 'position_unavailable';
  if (code === 3) return 'timeout';
  return 'unknown_error';
}

/**
 * Requests the browser's current position exactly once. `geolocation` is `undefined` on
 * browsers/contexts where the API doesn't exist (or where a Permissions-Policy has disabled it)
 * that resolves to `{ ok: false, reason: 'unsupported' }` rather than throwing, so the caller can
 * always fall through to `ManualPlaceSearchForm`.
 */
export function requestBrowserLocation(
  geolocation: GeolocationApi | undefined,
  options: PositionOptionsLike = {},
): Promise<GeolocationOutcome> {
  if (!geolocation) {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }
  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          position: { lat: position.coords.latitude, lng: position.coords.longitude },
        });
      },
      (error) => {
        resolve({ ok: false, reason: reasonForErrorCode(error.code) });
      },
      { ...DEFAULT_OPTIONS, ...options },
    );
  });
}
