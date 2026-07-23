/**
 * SSR markup smoke test for the layer model control radiogroup.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { LayerModelControl } from './LayerModelControl';

test('exposes a radiogroup labelled Map data model', () => {
  const noop = () => {};
  const html = renderToStaticMarkup(
    createElement(LayerModelControl, {
      layerMode: 'blackShare',
      popGeo: 'state',
      popDecade: '1870',
      onLayerModeChange: noop,
      onPopGeoChange: noop,
      onPopDecadeChange: noop,
      onPopFromChange: noop,
      onPopToChange: noop,
    }),
  );
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /aria-label="Map data model"/);
  assert.match(html, /Black population share/);
  assert.match(html, /Geography/);
  assert.match(html, /State \(1790 to 2020\)/);
  assert.match(html, /Census decade/);
  assert.match(html, /1870/);
});
