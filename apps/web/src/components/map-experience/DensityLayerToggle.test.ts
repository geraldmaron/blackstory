/**
 * SSR markup smoke test for the BB-051 density-layer toggle's accessible state exposure.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { DensityLayerToggle } from './DensityLayerToggle';

test('exposes aria-pressed reflecting the enabled state', () => {
  const onToggle = () => {};
  const on = renderToStaticMarkup(createElement(DensityLayerToggle, { enabled: true, onToggle }));
  const off = renderToStaticMarkup(createElement(DensityLayerToggle, { enabled: false, onToggle }));
  assert.match(on, /aria-pressed="true"/);
  assert.match(off, /aria-pressed="false"/);
});
