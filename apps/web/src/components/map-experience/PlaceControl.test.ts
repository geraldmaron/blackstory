import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { PlaceControl, type PlaceControlProps } from './PlaceControl';

const BASE: PlaceControlProps = {
  catalogFeatures: [],
  onResolved: () => {},
  onLocate: () => {},
  locating: false,
  placed: false,
  radiusId: 'all',
  onRadiusChange: () => {},
};

test('one field with the locate action at its edge; location runs only on a press', () => {
  const html = renderToStaticMarkup(createElement(PlaceControl, BASE));
  assert.match(html, /role="search"/);
  assert.match(html, /placeholder="City, state, ZIP or record"/);
  assert.match(html, /aria-label="Use my location"/);
  assert.match(html, /role="status"[^>]*aria-live="polite"/);
  // The privacy statement is one disclosure away, closed.
  assert.match(html, /<details class="ds-place__privacy"><summary>How location works<\/summary>/);
  assert.match(html, /stays in\s+this browser/);
  assert.match(html, /U\.S\. Census geocoder/);
});

test('without onLocate the field carries no locate button: the map owns that one control', () => {
  const { onLocate: _onLocate, ...rest } = BASE;
  const html = renderToStaticMarkup(createElement(PlaceControl, rest));
  assert.doesNotMatch(html, /Use my location/);
});

test('the radius appears only once a place is set', () => {
  assert.doesNotMatch(renderToStaticMarkup(createElement(PlaceControl, BASE)), /radiogroup/);
  const html = renderToStaticMarkup(createElement(PlaceControl, { ...BASE, placed: true }));
  assert.match(html, /role="radiogroup" aria-label="Distance from the place"/);
  assert.match(html, />5 mi</);
});
