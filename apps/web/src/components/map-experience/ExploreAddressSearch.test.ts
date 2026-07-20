/**
 * SSR markup smoke test for explore place finder — field, All radius chip, Go action,
 * and polite live region (WCAG).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExploreAddressSearch } from './ExploreAddressSearch';

test('renders place field, All radius chip, and live status region', () => {
  const html = renderToStaticMarkup(createElement(ExploreAddressSearch, { onResolved: () => {} }));
  assert.match(html, /Place/);
  assert.match(html, /City, state, or ZIP/);
  assert.match(html, />Go</);
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /aria-checked="true"[^>]*>All</);
  assert.match(html, /5 mi/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
});
