/**
 * SSR markup smoke test for ManualPlaceSearchForm (always-available re-entry point).
 * Confirms the address/ZIP field is properly labelled (WCAG: `<label for>` bound to the input)
 * and that helper text / disabled state render.
 */
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { ManualPlaceSearchForm } from './ManualPlaceSearchForm';

const { createElement } = React;

// Workaround for a pre-existing gap in `@blap/ui`'s FilterBar.tsx/Button.tsx see
// `./LocationConsentButton.test.ts`'s identical note.
(globalThis as Record<string, unknown>).React = React;

test('renders a labelled address/ZIP search field with a submit action', () => {
  const html = renderToStaticMarkup(
    createElement(ManualPlaceSearchForm, { onSubmit: () => {} }),
  );
  assert.match(html, /<label[^>]*for="locate-address"/);
  assert.match(html, /<input[^>]*id="locate-address"/);
  assert.match(html, /<input[^>]*name="address"/);
  assert.match(html, />Find jurisdiction</);
});

test('renders helper text when provided (used for the post-fallback re-prompt)', () => {
  const html = renderToStaticMarkup(
    createElement(ManualPlaceSearchForm, {
      onSubmit: () => {},
      helperText: 'We could not match that address.',
    }),
  );
  assert.match(html, /We could not match that address\./);
});

test('disables the submit button while a lookup is in flight', () => {
  const html = renderToStaticMarkup(
    createElement(ManualPlaceSearchForm, { onSubmit: () => {}, disabled: true }),
  );
  assert.match(html, /<button[^>]*disabled[^>]*>Looking up…/);
});
