/**
 * Destination glyphs are decorative; the visible label remains the name.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { DestinationIcon } from './DestinationIcon';

test('the glyph is hidden from the accessibility tree', () => {
  const html = renderToStaticMarkup(createElement(DestinationIcon, { id: 'methodology' }));
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /ds-destination-icon/);
  assert.doesNotMatch(html, /ds-destination-icon--md/);
});

test('the medium size is opt-in for headings and cards', () => {
  const html = renderToStaticMarkup(createElement(DestinationIcon, { id: 'data', size: 'md' }));
  assert.match(html, /ds-destination-icon--md/);
});

test('the large size is opt-in for chapter plates', () => {
  const html = renderToStaticMarkup(createElement(DestinationIcon, { id: 'source', size: 'lg' }));
  assert.match(html, /ds-destination-icon--lg/);
});
