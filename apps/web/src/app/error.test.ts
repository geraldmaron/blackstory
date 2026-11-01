/**
 * SSR markup smoke test for the segment error boundary: confirms
 * it renders through the shared `sanitizeClientErrorDisplay` production-safe handler.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { UtilityEditionErrorView as ErrorBoundary } from '../components/patterns/utility-edition/UtilityEditionErrorView';
import RouteErrorBoundary from './error';

function renderRouteBoundary(error: Error & { digest?: string }): string {
  return renderToStaticMarkup(createElement(RouteErrorBoundary, { error, reset: () => {} }));
}

test('The route error boundary every public route inherits shows a retry and a way home', () => {
  const html = renderRouteBoundary(new Error('anything'));
  assert.match(html, /Something went wrong/);
  assert.match(html, /<button[^>]*type="button"[^>]*>Try again<\/button>/);
  assert.match(html, /<a[^>]*href="\/"[^>]*>Back to home<\/a>/);
});

test('The route error boundary never prints the raw message or stack in production', () => {
  const prior = process.env.NEXT_PUBLIC_APP_ENV;
  process.env.NEXT_PUBLIC_APP_ENV = 'production';
  try {
    const error = Object.assign(new Error('secret connection string at db.internal'), {
      digest: 'ref987',
    });
    const html = renderRouteBoundary(error);
    assert.match(html, /Reference ref987/);
    assert.doesNotMatch(html, /secret connection string|db\.internal/);
    assert.doesNotMatch(html, /\bat .*\.(ts|js):\d+/);
  } finally {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
    else process.env.NEXT_PUBLIC_APP_ENV = prior;
  }
});

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
