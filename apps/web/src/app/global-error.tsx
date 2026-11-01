/**
 * Root-layout failure fallback. It replaces the root layout, so it owns its own html and body and
 * depends on nothing from the shell, the design system or the root stylesheet: if the CSS failed
 * to load it still reads as a plain, accessible page. Only fixed copy is printed — never the
 * message, stack or digest.
 */

'use client';

import React from 'react';

void React;

const page = {
  margin: 0,
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  background: 'var(--ds-canvas, #ffffff)',
  color: 'var(--ds-ink, #1a1a1a)',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  lineHeight: 1.5,
} as const;

const button = {
  minHeight: '44px',
  padding: '0 20px',
  border: '1px solid currentColor',
  borderRadius: '6px',
  font: 'inherit',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  background: 'transparent',
  color: 'inherit',
} as const;

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong</title>
      </head>
      <body style={page}>
        <main style={{ maxWidth: '36rem' }}>
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 12px' }}>Something went wrong</h1>
          <p role="alert" style={{ margin: '0 0 24px' }}>
            BlackStory could not load this page. You can try again or go back to the home page.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <button type="button" style={button} onClick={reset}>
              Try again
            </button>
            {/* A plain anchor on purpose: the router may be what failed. */}
            <a href="/" style={button}>
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
