/**
 * SSR markup smoke test confirming the legend explains every visual distinction in words
 * (WCAG 1.4.1 Use of Color), not color/glyph alone: kind shades + glyphs, the size scale,
 * clusters, the density layer, state labels, and confidence glyphs.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { MapExperienceLegend, type MapExperienceLegendProps } from './MapExperienceLegend';
import {
  KIND_ENCODING_ENTRIES,
  SEMANTIC_TONE_ENTRIES,
} from '../../lib/map-experience/kind-encoding';

test('explains points, clusters, the density layer, and confidence glyphs in words', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /radius affordance/);
  assert.match(html, /cluster/i);
  assert.match(html, /Group nearby/);
  assert.match(html, /full entity page/);
  assert.match(html, /Choose a model/);
  assert.match(html, /High/);
  assert.match(html, /medium/);
  assert.match(html, /low \(orange\)/);
  assert.match(html, /Streets/);
});

test('states that color marks kind and historical tones, in words', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /Color marks the kind of place or record/);
  assert.match(html, /Historical tones/);
});

test('lists every kind and semantic tone with its label and glyph name in words', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  for (const [, entry] of [...KIND_ENCODING_ENTRIES, ...SEMANTIC_TONE_ENTRIES]) {
    assert.match(html, new RegExp(entry.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, new RegExp(`\\(${entry.glyph}\\)`));
  }
});

test('explains the size scale as evidence depth, with confidence called out as separate', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /more documented evidence/);
  assert.match(html, /Confidence in that evidence is shown\s+separately/);
});

test('explains state labels and the copper selected-state convention in words', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /state labels/i);
  assert.match(html, /turns copper/);
});

test('is a native, keyboard-accessible disclosure (details/summary), open by default', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /<details[^>]*class="ds-explore-legend"[^>]*open/);
  assert.match(html, /<summary/);
});

test('defaultCollapsed renders the disclosure closed', () => {
  // Explicit generic argument: `MapExperienceLegend`'s single parameter is optional (so it can
  // be called with zero props for the common case), and TS's `createElement<P>` overload cannot
  // always infer `P` from an all-optional-parameter function component this is a test-only
  // inference quirk real JSX usage (`<MapExperienceLegend defaultCollapsed />`) type-checks fine.
  const html = renderToStaticMarkup(
    createElement<MapExperienceLegendProps>(MapExperienceLegend, { defaultCollapsed: true }),
  );
  assert.match(html, /<details class="ds-explore-legend">/);
  assert.doesNotMatch(html, /<details[^>]*open/);
});

test('shows a visible color key for state and county boundary colors', () => {
  const html = renderToStaticMarkup(
    createElement(MapExperienceLegend, { colorScheme: 'light' }),
  );
  assert.match(html, /Color key/);
  assert.match(html, /State outline/);
  assert.match(html, /County line/);
  assert.match(html, /Selected state/);
  assert.match(html, /ds-map-color-key/);
});

test('color key includes share tiers when blackShare layer is active', () => {
  const html = renderToStaticMarkup(
    createElement(MapExperienceLegend, { layerMode: 'blackShare', colorScheme: 'light' }),
  );
  assert.match(html, /Black population share by county/);
  assert.match(html, /Under 2%/);
  assert.match(html, /50%\+/);
});

test('kind swatches and confidence glyphs are aria-hidden (the accessible content is the adjacent text)', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  const glyphSwatchCount = (html.match(/class="ds-legend-glyph[^"]*"[^>]*aria-hidden="true"/g) ?? []).length;
  assert.equal(glyphSwatchCount, KIND_ENCODING_ENTRIES.length + SEMANTIC_TONE_ENTRIES.length);
});
