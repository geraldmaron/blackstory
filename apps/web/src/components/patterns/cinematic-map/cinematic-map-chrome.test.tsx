/**
 * Component-level coverage for the Cinematic Map Backdrop chrome layer
 * (`docs/ui/patterns-cinematic-map.md` §9): markup/attribute assertions via
 * `renderToStaticMarkup`, mirroring `components/MakerCredit.test.tsx`'s plain `node:test` style.
 * No DOM/jsdom — pointer-events/opacity transitions live in cinematic-map.css and are not
 * re-asserted here beyond the `data-cinematic-state` attribute the CSS keys off of.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CinematicMapProvider, type CinematicMapDriver } from './CinematicMapProvider';
import { CinematicScrim } from './CinematicScrim';
import { ExploreMapControl } from './ExploreMapControl';
import { CinematicMapClose } from './CinematicMapClose';
import { MapIntroBeat } from './MapIntroBeat';

void React;

const NOOP_DRIVER: CinematicMapDriver = {
  select: () => {},
  deselect: () => {},
  flyTo: () => {},
};

describe('CinematicScrim', () => {
  it('renders inert and tagged with the rest state by default', () => {
    const html = renderToStaticMarkup(
      <CinematicMapProvider homePreset="national" driver={NOOP_DRIVER}>
        <CinematicScrim />
      </CinematicMapProvider>,
    );
    assert.match(html, /class="ds-map-scrim"/);
    assert.match(html, /data-cinematic-state="rest"/);
    assert.match(html, /aria-hidden="true"/);
  });
});

describe('ExploreMapControl', () => {
  it('is a real button, ≥44px via its CSS class, aria-pressed false at rest', () => {
    const html = renderToStaticMarkup(
      <CinematicMapProvider homePreset="national" driver={NOOP_DRIVER}>
        <ExploreMapControl />
      </CinematicMapProvider>,
    );
    assert.match(html, /<button/);
    assert.match(html, /class="ds-explore-map-control"/);
    assert.match(html, /aria-pressed="false"/);
    assert.match(html, />Explore the map</);
  });

  it('accepts a custom label', () => {
    const html = renderToStaticMarkup(
      <CinematicMapProvider homePreset="national" driver={NOOP_DRIVER}>
        <ExploreMapControl label="View the map" />
      </CinematicMapProvider>,
    );
    assert.match(html, />View the map</);
  });
});

describe('CinematicMapClose', () => {
  it('renders nothing while Rest (Close is Engaged-only, spec §5)', () => {
    const html = renderToStaticMarkup(
      <CinematicMapProvider homePreset="national" driver={NOOP_DRIVER}>
        <CinematicMapClose />
      </CinematicMapProvider>,
    );
    assert.equal(html, '');
  });
});

describe('MapIntroBeat', () => {
  it('wraps its children in an inert scroll-anchor tagged with the current state', () => {
    const html = renderToStaticMarkup(
      <CinematicMapProvider homePreset="national" driver={NOOP_DRIVER}>
        <MapIntroBeat preset="state" entityId="entity-1">
          <p>A place and what happened there.</p>
        </MapIntroBeat>
      </CinematicMapProvider>,
    );
    assert.match(html, /class="ds-cinematic-beat"/);
    assert.match(html, /data-cinematic-state="rest"/);
    assert.match(html, /A place and what happened there\./);
  });
});
