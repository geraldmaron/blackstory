/**
 * Lens: the tabs are gone, every group is present in one pass, and the controls announce state.
 *
 * The "no tabs" assertion is the point of the package. v6 hid the colour key and half the filters
 * behind a segmented control; a regression that reintroduces tabs would look fine in a screenshot
 * and quietly undo the change, so the absence is asserted rather than assumed.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { LensPanel, type LensPanelProps } from './LensPanel';
import { MAP_KIND_FAMILY_ENCODING } from '../../lib/map-experience/kind-encoding';

function lensProps(overrides: Partial<LensPanelProps> = {}): LensPanelProps {
  return {
    matched: 4078,
    total: 4078,
    stateOptions: [
      { value: 'AL', label: 'Alabama' },
      { value: 'MS', label: 'Mississippi' },
    ],
    state: '',
    onStateChange: () => {},
    kindCounts: { people: 812, places: 1330, organizations: 402, events: 977, sources: 557 },
    kindFamily: null,
    onKindFamilyChange: () => {},
    evidenceFloor: 'any',
    onEvidenceFloorChange: () => {},
    layers: { pins: true, routes: false, labels: true, satellite: false },
    onLayerToggle: () => {},
    presence: [
      { postalCode: 'DC', name: 'District of Columbia', count: 372 },
      { postalCode: 'SC', name: 'South Carolina', count: 285 },
    ],
    onReset: () => {},
    ...overrides,
  };
}

test('every group is visible in one panel, with no tabs', () => {
  const html = renderToStaticMarkup(createElement(LensPanel, lensProps()));
  for (const group of ['Where', 'Kind', 'Evidence floor', 'Layers', 'Deepest coverage']) {
    assert.match(html, new RegExp(group), `missing group: ${group}`);
  }
  assert.equal(html.includes('role="tab"'), false, 'v6 tabs must not come back');
  assert.equal(html.includes('role="tablist"'), false);
});

test('there is no Apply button; filters auto-apply', () => {
  const html = renderToStaticMarkup(createElement(LensPanel, lensProps()));
  assert.equal(/>\s*Apply\s*</.test(html), false);
  assert.match(html, /Reset lens/);
});

test('kind chips carry the family label, its live count and a pressed state', () => {
  const html = renderToStaticMarkup(createElement(LensPanel, lensProps({ kindFamily: 'places' })));
  for (const entry of Object.values(MAP_KIND_FAMILY_ENCODING)) {
    assert.match(html, new RegExp(entry.label), `missing kind family: ${entry.label}`);
  }
  assert.match(html, /1,330/);
  assert.equal(html.match(/aria-pressed="true"/g)?.length, 4, 'places + Any floor + 2 on layers');
});

test('evidence floor chips read as and-up and carry a grade dot', () => {
  const html = renderToStaticMarkup(createElement(LensPanel, lensProps({ evidenceFloor: 'B' })));
  assert.match(html, /C and up/);
  assert.match(html, /B and up/);
  assert.match(html, /A only/);
  assert.match(html, /Evidence grade B/);
});

test('layer chips report their own on/off state', () => {
  const html = renderToStaticMarkup(
    createElement(
      LensPanel,
      lensProps({ layers: { pins: true, routes: true, labels: false, satellite: false } }),
    ),
  );
  assert.match(html, /Archive pins/);
  assert.match(html, /Migration routes/);
  assert.match(html, /Place labels/);
  assert.match(html, /Satellite imagery/);
});

test('presence bars name the state in words, not only as a bar', () => {
  const html = renderToStaticMarkup(createElement(LensPanel, lensProps()));
  assert.match(html, /District of Columbia/);
  assert.match(html, /372/);
});

test('the header reports how much of the release is in view', () => {
  const html = renderToStaticMarkup(createElement(LensPanel, lensProps({ matched: 285 })));
  assert.match(html, /285 in view/);
});

test('Near me only renders when the surface can actually geolocate', () => {
  assert.equal(
    renderToStaticMarkup(createElement(LensPanel, lensProps())).includes('Near me'),
    false,
  );
  assert.match(
    renderToStaticMarkup(createElement(LensPanel, lensProps({ onNearMe: () => {} }))),
    /Near me/,
  );
});

test('copy carries no em dash', () => {
  const html = renderToStaticMarkup(createElement(LensPanel, lensProps()));
  assert.equal(html.includes('—'), false);
});
