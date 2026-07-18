/**
 * Static privacy disclosure for the `/locate` geocode experience. Plain, server-safe
 * (no hooks, no `'use client'`) so it renders in the initial HTML even before
 * `LocateExperience.tsx` hydrates a no-JS visitor still sees exactly what this feature does
 * with their input before any interactive control appears.
 */
import React from 'react';
import { Notice } from '@blap/ui';

// See `@blap/ui`'s Notice.tsx/EmptyState.tsx for why this otherwise-unused import stays:
// it makes this file safe to cross-transpile under a classic JSX runtime (e.g. this app's own
// test runner), where compiled JSX needs `React` in scope.
void React;

export function LocationPrivacyNotice() {
  return (
    <Notice tone="warning" title="How this lookup uses your location">
      <ul className="bp-stack" style={{ gap: 'var(--bp-space-1)', margin: 0, paddingLeft: '1.1em' }}>
        <li>
          Using your device&rsquo;s location requires you to press the button below — this page
          never requests it automatically.
        </li>
        <li>
          An address, ZIP, or coordinate is sent to the U.S. Census Bureau&rsquo;s public geocoder
          only to resolve the state, county, and (when applicable) city it falls within.
        </li>
        <li>
          The exact coordinate is discarded immediately after that resolution; a ZIP code you
          enter is translated to a place and then discarded — neither is kept as a stored history
          of your searches.
        </li>
        <li>
          If the lookup fails or the result is outside the 50 states and D.C., you can always
          search by place name instead.
        </li>
      </ul>
    </Notice>
  );
}
