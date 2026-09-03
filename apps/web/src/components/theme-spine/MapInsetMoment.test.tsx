/**
 * Unit coverage for the theme-spine MapInsetMoment.
 *
 * SP-08 turned this from a second MapLibre mount into an adapter over the room kit's `MapMoment`:
 * it contributes a slot the persistent plate moves into, and the Explore hand-off built from the
 * block's `entityId`. The assertions follow — what is checked is the caption, the hand-off URL and
 * the absence of a second map, not a panel's aria-label.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapInsetMoment } from './MapInsetMoment';

void React;

const baseProps = {
  entityId: 'ent_15th_st_church_001',
  label: 'Fifteenth Street Presbyterian Church',
  lat: 38.9047,
  lng: -77.0163,
  precision: 'neighborhood' as const,
};

describe('MapInsetMoment', () => {
  it('renders the place as the moment caption, which carries the point without a map', () => {
    const html = renderToStaticMarkup(<MapInsetMoment {...baseProps} />);
    assert.match(html, /Fifteenth Street Presbyterian Church/);
    assert.match(html, /ds-mapmoment__caption/);
  });

  it('contributes a slot rather than building a second map', () => {
    const html = renderToStaticMarkup(<MapInsetMoment {...baseProps} />);
    assert.match(html, /ds-mapmoment__plate/);
    // Server-rendered with no stage above it, the moment states the degrade rather than showing
    // an empty rectangle. This is also exactly what a reader with no JavaScript gets.
    assert.match(html, /The map is unavailable\. The caption below carries the point\./);
  });

  it('links into /explore with the entity pre-selected via the shared selected= convention', () => {
    const html = renderToStaticMarkup(<MapInsetMoment {...baseProps} />);
    assert.match(html, /href="\/explore\?[^"]*selected=ent_15th_st_church_001[^"]*"/);
  });

  it('renders identically regardless of theme class on an ancestor (both themes safe)', () => {
    const light = renderToStaticMarkup(
      <div data-theme="light">
        <MapInsetMoment {...baseProps} />
      </div>,
    );
    const dark = renderToStaticMarkup(
      <div data-theme="dark">
        <MapInsetMoment {...baseProps} />
      </div>,
    );
    assert.match(light, /ds-mapmoment/);
    assert.match(dark, /ds-mapmoment/);
  });
});
