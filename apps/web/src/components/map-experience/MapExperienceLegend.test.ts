/**
 * SSR markup test confirming the legend explains every visual distinction in words (WCAG 1.4.1
 * Use of Color): the precision marks, groups, selection and the opt-in area layers.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { MapExperienceLegend, type MapExperienceLegendProps } from './MapExperienceLegend';
import { plateForScheme } from '../../lib/map-experience/dignity-style';

function render(props: MapExperienceLegendProps = {}): string {
  return renderToStaticMarkup(createElement<MapExperienceLegendProps>(MapExperienceLegend, props));
}

test('names each precision mark in words, including the no-point county and state case', () => {
  const html = render();
  assert.match(html, /Placed at the site/);
  assert.match(html, /Placed to the neighborhood or city/);
  assert.match(html, /Placed to the county or state, counted at the state label/);
  assert.match(html, /Selected record/);
  assert.match(html, /never a street corner/);
});

test('says kind is not encoded by mark color', () => {
  assert.match(render(), /Kind is shown in the list and in the record, not by the color of a mark/);
});

test('lists the three group size steps and says a group never places a record', () => {
  const html = render();
  assert.match(html, /2 to 9 records/);
  assert.match(html, /10 to 99 records/);
  assert.match(html, /100 or more/);
  assert.match(html, /A group never says where any one record is/);
});

test('area shading is off by default and the density layer is described as coverage', () => {
  assert.match(render(), /No area shading is on/);
  const presence = render({ layerMode: 'presence' });
  assert.match(presence, /Record density by state/);
  assert.match(presence, /not where history happened/);
});

test('is a native, keyboard-accessible disclosure (details/summary), open by default', () => {
  assert.match(render(), /<details[^>]*class="ds-explore-legend"[^>]*open/);
  const collapsed = render({ defaultCollapsed: true });
  assert.match(collapsed, /<details class="ds-explore-legend">/);
  assert.doesNotMatch(collapsed, /<details[^>]*open/);
});

test('SSR without colorScheme uses light plate swatches (hydration-safe; no document read)', () => {
  const light = plateForScheme('light');
  const dark = plateForScheme('dark');
  const html = render();
  assert.match(html, new RegExp(light.stateBounds, 'i'));
  assert.doesNotMatch(html, new RegExp(dark.stateBounds, 'i'));
});

test('onHide renders an accessible Hide key control; embedded mode omits the heading', () => {
  const standalone = render({ colorScheme: 'light', onHide: () => undefined });
  assert.match(standalone, /aria-label="Hide key"/);
  const embedded = render({ colorScheme: 'light', embedded: true, onHide: () => undefined });
  assert.match(embedded, /aria-label="Map key"/);
  assert.doesNotMatch(embedded, /Hide key/);
});

test('population layers add their tier rows', () => {
  const share = render({ layerMode: 'blackShare', colorScheme: 'light' });
  assert.match(share, /Black population share by county/);
  assert.match(share, /Under 2%/);
  const change = render({ layerMode: 'blackChange', colorScheme: 'light' });
  assert.match(change, /Black share change by county/);
});

test('every swatch is aria-hidden: the accessible content is the adjacent text', () => {
  const html = render();
  const marks = html.match(/<span class="ds-legend-mark"[^>]*>/g) ?? [];
  assert.equal(marks.length, 6, 'three marks and three group sizes');
  for (const mark of marks) assert.match(mark, /aria-hidden="true"/);
});
