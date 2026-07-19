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
      popDecade: '2020',
      onLayerModeChange: noop,
      onPopDecadeChange: noop,
      onPopFromChange: noop,
      onPopToChange: noop,
    }),
  );
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /aria-label="Map data model"/);
  assert.match(html, /Black population share/);
  assert.match(html, /Census decade/);
});
