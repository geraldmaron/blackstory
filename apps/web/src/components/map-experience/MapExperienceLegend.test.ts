/**
 * SSR markup smoke test confirming the legend explains every visual distinction in words
 * (WCAG 1.4.1 Use of Color), not color/glyph alone.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { MapExperienceLegend } from './MapExperienceLegend';

test('explains points, clusters, the density layer, and confidence glyphs in words', () => {
  const html = renderToStaticMarkup(createElement(MapExperienceLegend));
  assert.match(html, /radius affordance/);
  assert.match(html, /cluster/i);
  assert.match(html, /presence, not incidents/);
  assert.match(html, /High/);
  assert.match(html, /medium/);
  assert.match(html, /low confidence/);
});
