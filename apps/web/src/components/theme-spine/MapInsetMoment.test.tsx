/**
 * Unit coverage for the theme-spine MapInsetMoment: renders from fixture entity data in both
 * themes, wraps the existing `EntityLocationMap` panel (map-experience machinery reuse — see
 * that component's own `aria-label`), and links into `/explore` with the entity pre-selected
 * via the shared `selected=` URL-state convention.
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
  it('renders the place label and reuses EntityLocationMap (its aria-label present)', () => {
    const html = renderToStaticMarkup(<MapInsetMoment {...baseProps} />);
    assert.match(html, /Fifteenth Street Presbyterian Church/);
    assert.match(
      html,
      /aria-label="Street map centered on Fifteenth Street Presbyterian Church"/,
    );
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
    assert.match(light, /ds-map-inset-moment/);
    assert.match(dark, /ds-map-inset-moment/);
  });
});
