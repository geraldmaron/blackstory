'use client';

/**
 * Client orchestrator for the `/locate` geocode experience: wires
 * `LocationConsentButton` (explicit browser-location consent) and `ManualPlaceSearchForm`
 * (always-available manual fallback) to `../../lib/geocode/locate-client.ts`'s `/locate/api`
 * fetch wrapper, and renders the outcome through `LocationResolutionPanel`. Kept out of
 * `app/locate/page.tsx` because that file is a Server Component (Next's route-file conventions
 * aside, this feature genuinely needs client state for the fetch/loading/result lifecycle)
 * `page.tsx` renders this component as its one client island.
 *
 * Every outcome resolved, manual-place-search fallback, rate limited, or errored is recorded
 * as one coarse analytics event via `../../lib/geocode/analytics-client.ts` (never the resolution
 * itself, never a coordinate/address/ZIP; see that module's doc for the console-only interim
 * sink).
 */
import React, { useId, useState } from 'react';
import { getLocateAppCheckHeaders } from '../../app/locate/app-check-client';
import {
  fetchLocateByAddress,
  fetchLocateByCoordinates,
  type LocateClientResult,
} from '../../lib/geocode/locate-client';
import {
  buildCoarseLocationAnalyticsEvent,
  recordCoarseLocationAnalyticsEvent,
} from '../../lib/geocode/analytics-client';
import { LocationConsentButton } from './LocationConsentButton';
import { ManualPlaceSearchForm } from './ManualPlaceSearchForm';
import { LocationResolutionPanel } from './LocationResolutionPanel';

// See `./LocationPrivacyNotice.tsx`'s identical note: keeps this file safe under a classic JSX
// runtime (this app's own test runner) even though the automatic runtime doesn't need it.
void React;

type LocateState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'done'; readonly result: LocateClientResult };

function recordOutcome(
  origin: 'browser_location_used' | 'address_lookup',
  result: LocateClientResult,
): void {
  if (result.kind === 'resolved') {
    recordCoarseLocationAnalyticsEvent(
      buildCoarseLocationAnalyticsEvent(
        origin === 'browser_location_used' ? 'browser_location_used' : 'geocode_resolved',
        result.resolution,
      ),
    );
    return;
  }
  if (result.kind === 'fallback') {
    recordCoarseLocationAnalyticsEvent(
      buildCoarseLocationAnalyticsEvent('manual_fallback_used', undefined),
    );
    return;
  }
  recordCoarseLocationAnalyticsEvent(
    buildCoarseLocationAnalyticsEvent('geocode_failed', undefined),
  );
}

export function LocateExperience() {
  const [state, setState] = useState<LocateState>({ status: 'idle' });
  const statusRegionId = useId();

  async function handleCoordinates(position: { readonly lat: number; readonly lng: number }) {
    setState({ status: 'loading' });
    const appCheckHeaders = await getLocateAppCheckHeaders();
    const result = await fetchLocateByCoordinates(position.lat, position.lng, appCheckHeaders);
    recordOutcome('browser_location_used', result);
    setState({ status: 'done', result });
  }

  async function handleAddress(address: string) {
    setState({ status: 'loading' });
    const appCheckHeaders = await getLocateAppCheckHeaders();
    const result = await fetchLocateByAddress(address, appCheckHeaders);
    recordOutcome('address_lookup', result);
    setState({ status: 'done', result });
  }

  function handleDenied() {
    recordCoarseLocationAnalyticsEvent(
      buildCoarseLocationAnalyticsEvent('manual_fallback_used', undefined),
    );
  }

  const loading = state.status === 'loading';

  return (
    <div className="ds-stack" style={{ gap: 'var(--ds-space-4)' }}>
      <LocationConsentButton
        onResolved={handleCoordinates}
        onDenied={handleDenied}
        disabled={loading}
      />

      <ManualPlaceSearchForm onSubmit={handleAddress} disabled={loading} />

      <div id={statusRegionId} aria-live="polite" role="status">
        {loading ? <p className="ds-sans">Looking up jurisdiction…</p> : null}
        {state.status === 'done' ? <LocationResolutionPanel result={state.result} /> : null}
      </div>
    </div>
  );
}
