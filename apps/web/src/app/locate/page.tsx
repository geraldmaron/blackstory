/**
 * Public "find your jurisdiction" page: U.S. address and current-location discovery.
 * Thin Server Component the privacy disclosure (`LocationPrivacyNotice`) and a no-JS-safe
 * fallback link render on the server; the one interactive client island
 * (`LocateExperience`, which owns browser-location consent, manual address/ZIP entry, and the
 * `/locate/api` fetch/result lifecycle) hydrates on top of it.
 */
import React from 'react';
import { LocateExperience, LocationPrivacyNotice } from '../../components/location';

// See `../../components/location/LocationPrivacyNotice.tsx`'s identical note: keeps this file
// safe under a classic JSX runtime even though the automatic runtime doesn't need it.
void React;

export const metadata = {
  title: 'Find your jurisdiction',
  description:
    'Resolve an address, ZIP, or your current location to the U.S. state, county, and city it falls within.',
};

export default function LocatePage() {
  return (
    <main className="ds-container ds-page" id="main">
      <header className="ds-entity-mast">
        <p className="ds-page__eyebrow">Discover</p>
        <h1 className="ds-page__title">Find your jurisdiction</h1>
        <p className="ds-page__lede">
          Enter an address, city and state, or ZIP — or use your current location — to find the
          state, county, and city (50 states + D.C. only) it falls within.
        </p>
      </header>

      <div
        className="ds-stack"
        style={{ marginTop: 'var(--ds-space-6)', gap: 'var(--ds-space-4)' }}
      >
        <LocationPrivacyNotice />
        <LocateExperience />
        <noscript>
          <p className="ds-sans">
            This page needs JavaScript for location lookup. You can still{' '}
            <a className="ds-cta ds-cta--ink" href="/search">
              search records directly
            </a>
            .
          </p>
        </noscript>
      </div>
    </main>
  );
}
