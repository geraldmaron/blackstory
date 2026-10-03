import { useCallback, useRef, useState } from 'react';
import type { UseToasts } from '../../../components/patterns/Toast';
import {
  requestBrowserLocation,
  type GeolocationDenialReason,
} from '../../../lib/geocode/browser-geolocation';
import {
  buildCoarseLocationAnalyticsEvent,
  recordCoarseLocationAnalyticsEvent,
} from '../../../lib/geocode/analytics-client';
import type { NearbyArea } from '../../../lib/map-experience/nearby';

export type LocateStatus = 'idle' | 'locating' | 'error';

/** What a reader can do next, for each way the browser can say no. */
export const LOCATE_FAILURE_MESSAGES: Readonly<Record<GeolocationDenialReason, string>> = {
  unsupported: 'This browser can’t share a location. Search for a place instead.',
  permission_denied:
    'Location is turned off for this site. Allow it in your browser’s site settings, or search for a place.',
  position_unavailable: 'Your location couldn’t be found right now. Try again, or search for a place.',
  timeout: 'Finding your location took too long. Try again, or search for a place.',
  unknown_error: 'Something went wrong finding your location. Try again, or search for a place.',
};

/**
 * The one "locate me" action. The on-map button, the Filters panel's "Near me" and the place
 * finder's "Use my current location" all call this, so they cannot drift into three behaviours.
 *
 * Explicit consent only: the browser prompt can only follow a press of one of those controls.
 * The position stays in client state (the lens's `nearby`); it is not sent to the server and is
 * never written to the URL. Analytics records only that the feature was used, never where.
 */
export function useLocateMe(toasts: UseToasts, setNearby: (area: NearbyArea | null) => void) {
  const [status, setStatus] = useState<LocateStatus>('idle');
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('locating');
    try {
      const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
      const outcome = await requestBrowserLocation(geolocation);
      if (!outcome.ok) {
        setStatus('error');
        recordCoarseLocationAnalyticsEvent(
          buildCoarseLocationAnalyticsEvent('manual_fallback_used', undefined),
        );
        toasts.show({
          id: `locate-${Date.now()}`,
          message: LOCATE_FAILURE_MESSAGES[outcome.reason],
        });
        return;
      }
      recordCoarseLocationAnalyticsEvent(
        buildCoarseLocationAnalyticsEvent('browser_location_used', undefined),
      );
      setStatus('idle');
      setNearby({
        center: { lat: outcome.position.lat, lng: outcome.position.lng },
        label: 'your location',
        source: 'device',
        ...(outcome.position.accuracy !== undefined
          ? { accuracyMeters: outcome.position.accuracy }
          : {}),
        radiusMeters: null,
      });
    } finally {
      inFlight.current = false;
    }
  }, [setNearby, toasts]);

  const locate = useCallback(() => {
    void run();
  }, [run]);

  return { locate, status } as const;
}
