/**
 * Static privacy disclosure for the `/locate` geocode experience. Plain, server-safe
 * (no hooks, no `'use client'`) so it renders in the initial HTML even before
 * `LocateExperience.tsx` hydrates a no-JS visitor still sees exactly what this feature does
 * with their input before any interactive control appears.
 *
 * Collapsed by default via native `<details>`. The summary is quiet text, not a warning card;
 * the four bullets are one tap away.
 */
import React from 'react';

void React;

export function LocationPrivacyNotice() {
  return (
    <details className="ds-location-privacy-notice">
      <summary className="ds-sans ds-location-privacy-notice__summary">
        Location is opt-in. Press the button below; nothing runs automatically.
      </summary>
      <div className="ds-location-privacy-notice__body">
        <ul
          className="ds-stack"
          style={{ gap: 'var(--ds-space-1)', margin: 0, paddingLeft: '1.1em' }}
        >
          <li>
            Using your device&rsquo;s location requires you to press the button below. This page
            never requests it automatically.
          </li>
          <li>
            An address, ZIP, or coordinate is sent to the U.S. Census Bureau&rsquo;s public geocoder
            only to resolve the state, county, and (when applicable) city it falls within.
          </li>
          <li>
            The exact coordinate is discarded immediately after that resolution; a ZIP code you
            enter is translated to a place and then discarded. Neither is kept as a stored history
            of your searches.
          </li>
          <li>
            If the lookup fails or the result is outside the 50 states and D.C., you can always
            search by place name instead.
          </li>
        </ul>
      </div>
    </details>
  );
}
