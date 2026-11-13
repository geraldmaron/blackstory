/**
 * Unit coverage for the theme-spine MapInsetMoment: a chapter's map inset is the shared
 * RecordMap, framed by the record's stored precision, with one hand-off into /explore.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
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
  it('renders the place and its precision in words as server HTML', () => {
    const html = renderToStaticMarkup(<MapInsetMoment {...baseProps} />);
    assert.match(html, /<figure class="ds-record-map">/);
    assert.match(html, /Fifteenth Street Presbyterian Church/);
    assert.match(html, /Placed to the neighborhood/);
  });

  it('links into /explore with the entity pre-selected via the shared selected= convention', () => {
    const html = renderToStaticMarkup(<MapInsetMoment {...baseProps} />);
    assert.match(
      html,
      /href="\/explore\?[^"]*selected=ent_15th_st_church_001[^"]*">Open on the map</,
    );
  });

  it('never moves its own camera, so no inset can dramatize a place (P-04)', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../map-embed/RecordMap.tsx', import.meta.url)),
      'utf8',
    );
    assert.doesNotMatch(source, /\.(flyTo|easeTo|fitBounds)\(/);
    assert.match(source, /zoomForLocationPrecision\(precision\)/);
    assert.match(source, /cooperativeGestures: true/);
  });
});
