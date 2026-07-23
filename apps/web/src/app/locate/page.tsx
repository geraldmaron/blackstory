/**
 * Public "find your jurisdiction" page: U.S. address and current-location discovery.
 * v6 utility edition with shared gutter mosaic; client island owns consent + lookup.
 */
import React from 'react';
import { LocateExperience, LocationPrivacyNotice } from '../../components/location';
import { UtilityEditionBodyPanel } from '../../components/patterns/utility-edition/UtilityEditionBodyPanel';
import { UtilityEditionIntro } from '../../components/patterns/utility-edition/UtilityEditionIntro';
import { UtilityEditionShell } from '../../components/patterns/utility-edition/UtilityEditionShell';
import '../../components/patterns/utility-edition/utility-edition.css';

void React;

export const metadata = {
  title: 'Find your jurisdiction',
  description:
    'Resolve an address, ZIP, or your current location to the U.S. state, county, and city it falls within.',
};

export default function LocatePage() {
  return (
    <UtilityEditionShell mosaicSeed="locate-edition-v6" editionKey="locate">
      <UtilityEditionIntro
        kicker="Discover"
        title="Find your jurisdiction"
        lede="Enter an address, city and state, or ZIP — or use your current location — to find the state, county, and city (50 states + D.C. only) it falls within."
      />
      <UtilityEditionBodyPanel>
        <LocationPrivacyNotice />
        <LocateExperience />
        <noscript>
          <p className="ds-sans">
            This page needs JavaScript for location lookup. You can still{' '}
            <a className="ds-cta ds-cta--ink" href="/history">
              search records directly
            </a>
            .
          </p>
        </noscript>
      </UtilityEditionBodyPanel>
    </UtilityEditionShell>
  );
}
