/**
 * SSR markup smoke test for LocationConsentButton.
 * Proves the idle button never carries any indication of an in-flight/granted permission before
 * a click, and that the status region is wired for assistive technology (`aria-live`,
 * `aria-describedby`). The click-driven `navigator.geolocation` flow itself is covered by
 * `../../lib/geocode/browser-geolocation.test.ts` against a fake API this test only proves the
 * button never calls it on render/mount (no effect runs during a static SSR render).
 */
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { LocationConsentButton } from './LocationConsentButton';

const { createElement } = React;

// Workaround for a pre-existing gap in `@repo/ui`'s Button.tsx/FilterBar.tsx (unlike
// Notice.tsx/EmptyState.tsx in the same package, they don't import React for cross-transpile
// safety under a classic JSX runtime — see this app's `test` script, which resolves
// `@repo/ui` through its `development` package-export condition straight to `.tsx` source).
// Binding the global here is test-only.
(globalThis as Record<string, unknown>).React = React;

test('renders an idle, enabled button labelled "Use my current location"', () => {
  const html = renderToStaticMarkup(
    createElement(LocationConsentButton, { onResolved: () => {}, onDenied: () => {} }),
  );
  assert.match(html, />Use my current location</);
  assert.doesNotMatch(html, /disabled/);
});

test('wires an aria-live status region referenced by aria-describedby', () => {
  const html = renderToStaticMarkup(
    createElement(LocationConsentButton, { onResolved: () => {}, onDenied: () => {} }),
  );
  assert.match(html, /aria-describedby="locate-consent-status"/);
  assert.match(html, /id="locate-consent-status"[^>]*aria-live="polite"/);
});

test('respects an externally disabled state (e.g. while a manual lookup is in flight)', () => {
  const html = renderToStaticMarkup(
    createElement(LocationConsentButton, { onResolved: () => {}, onDenied: () => {}, disabled: true }),
  );
  assert.match(html, /<button[^>]*disabled/);
});
