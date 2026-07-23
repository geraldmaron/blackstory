/**
 * SSR markup smoke test for the segment error boundary: confirms
 * it renders through the shared `sanitizeClientErrorDisplay` production-safe
 * surfacing instead of the raw digest-only branch it used to hand-roll.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { UtilityEditionErrorView as ErrorBoundary } from '../components/patterns/utility-edition/UtilityEditionErrorView';

test('Error boundary renders a digest reference in production, never the raw message', () => {
  const prior = process.env.NEXT_PUBLIC_APP_ENV;
  process.env.NEXT_PUBLIC_APP_ENV = 'production';
  const error = Object.assign(new Error('secret connection string at db.internal'), {
    digest: 'abc123',
  });
  const html = renderToStaticMarkup(createElement(ErrorBoundary, { error, reset: () => {} }));
  assert.match(html, /Reference abc123/);
  assert.doesNotMatch(html, /secret connection string/);
  process.env.NEXT_PUBLIC_APP_ENV = prior;
});

test('Error boundary falls back to a generic message when no digest is present', () => {
  const prior = process.env.NEXT_PUBLIC_APP_ENV;
  process.env.NEXT_PUBLIC_APP_ENV = 'production';
  const error = new Error('anything');
  const html = renderToStaticMarkup(createElement(ErrorBoundary, { error, reset: () => {} }));
  assert.match(html, /transient fault interrupted this view/);
  process.env.NEXT_PUBLIC_APP_ENV = prior;
});
