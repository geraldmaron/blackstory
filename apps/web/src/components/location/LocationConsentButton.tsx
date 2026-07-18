'use client';

/**
 * Explicit-consent trigger for the browser's location permission prompt ("browser
 * location permission flow: explicit user action before access"). `navigator.geolocation` is
 * read and passed to `../../lib/geocode/browser-geolocation.ts`'s `requestBrowserLocation` only
 * inside this button's own `onClick` handler never in a `useEffect`, never on mount, never as
 * a side effect of any other control. There is no code path in this component that can trigger
 * the permission prompt without a user press.
 *
 * Status changes (requesting denied unsupported) are announced through a visually-hidden
 * `aria-live="polite"` region rather than relying on the button's own visible label text alone,
 * so screen reader users get the same feedback sighted users see in the label change.
 */
import React, { useState } from 'react';
import { Button } from '@blap/ui';
import {
  requestBrowserLocation,
  type BrowserCoordinates,
  type GeolocationDenialReason,
} from '../../lib/geocode/browser-geolocation';

// See `./LocationPrivacyNotice.tsx`'s identical note: keeps this file safe under a classic JSX
// runtime (this app's own test runner) even though the automatic runtime doesn't need it.
void React;

export type LocationConsentButtonProps = {
  readonly onResolved: (position: BrowserCoordinates) => void;
  readonly onDenied: (reason: GeolocationDenialReason) => void;
  readonly disabled?: boolean;
};

const DENIAL_MESSAGES: Readonly<Record<GeolocationDenialReason, string>> = {
  unsupported: 'Your browser does not support location lookup here. Use the search form below instead.',
  permission_denied: 'Location access was denied. Use the search form below instead.',
  position_unavailable: 'Your location could not be determined. Use the search form below instead.',
  timeout: 'Location lookup timed out. Use the search form below instead.',
  unknown_error: 'Something went wrong getting your location. Use the search form below instead.',
};

export function LocationConsentButton({ onResolved, onDenied, disabled = false }: LocationConsentButtonProps) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'denied'>('idle');
  const [denialMessage, setDenialMessage] = useState<string | undefined>(undefined);

  async function handleClick() {
    setStatus('requesting');
    setDenialMessage(undefined);
    const geolocation =
      typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    const outcome = await requestBrowserLocation(geolocation);
    if (outcome.ok) {
      setStatus('idle');
      onResolved(outcome.position);
      return;
    }
    setStatus('denied');
    setDenialMessage(DENIAL_MESSAGES[outcome.reason]);
    onDenied(outcome.reason);
  }

  return (
    <div className="bp-stack" style={{ gap: 'var(--bp-space-2)' }}>
      <Button
        type="button"
        onClick={handleClick}
        disabled={disabled || status === 'requesting'}
        aria-describedby="locate-consent-status"
      >
        {status === 'requesting' ? 'Requesting location…' : 'Use my current location'}
      </Button>
      <p id="locate-consent-status" role="status" aria-live="polite" className="bp-visually-hidden">
        {status === 'requesting' ? 'Requesting your location from the browser.' : ''}
        {status === 'denied' ? denialMessage : ''}
      </p>
      {status === 'denied' && denialMessage ? <p className="bp-sans">{denialMessage}</p> : null}
    </div>
  );
}
