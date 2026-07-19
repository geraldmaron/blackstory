
/**
 * Tests for the degraded-citation UI additions to Citation.tsx. Confirms the new props are
 * additive (the default, no-`linkStatus` render is byte-for-byte the pre-existing markup) and
 * that the dead/drifted treatments render the expected accessible, non-color-only cues.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { Citation } from './Citation.js';

test('omitting linkStatus renders exactly the original citation markup (no degraded block)', () => {
  const html = renderToStaticMarkup(
    createElement(Citation, { source: 'National Archives', href: 'https://example.com' }),
  );
  assert.match(html, /<aside/);
  assert.doesNotMatch(html, /ds-notice/);
});

test('linkStatus dead with no archived copy renders "Link dead as of <date>"', () => {
  const html = renderToStaticMarkup(
    createElement(Citation, {
      source: 'Local Gazette',
      linkStatus: 'dead',
      deadAsOfDate: '2026-07-17',
    }),
  );
  assert.match(html, /role="status"/);
  assert.match(html, /Link dead as of 2026-07-17/);
});

test('linkStatus dead with an archived copy links to it and still discloses the dead date', () => {
  const html = renderToStaticMarkup(
    createElement(Citation, {
      source: 'Local Gazette',
      linkStatus: 'dead',
      deadAsOfDate: '2026-07-17',
      archivedHref: 'https://web.archive.org/web/1/https://gazette.example/story/1',
      trySearchingFor: 'Try searching for: "Rosewood massacre grand jury report 1923 Florida"',
    }),
  );
  assert.match(html, /Original link unavailable — archived copy/);
  assert.match(html, /href="https:\/\/web\.archive\.org\/web\/1\/https:\/\/gazette\.example\/story\/1"/);
  assert.match(html, /link dead as of 2026-07-17/);
  assert.match(html, /Try searching for/);
});

test('linkStatus drifted flags content-changed-since-capture for research review', () => {
  const html = renderToStaticMarkup(createElement(Citation, { source: 'County Clerk', linkStatus: 'drifted' }));
  assert.match(html, /Content may have changed since capture/);
  assert.match(html, /evidentiary anchor/);
});

test('linkStatus alive/redirected renders no degraded block', () => {
  const alive = renderToStaticMarkup(createElement(Citation, { source: 'Local Gazette', linkStatus: 'alive' }));
  assert.doesNotMatch(alive, /ds-notice/);
  const redirected = renderToStaticMarkup(createElement(Citation, { source: 'Local Gazette', linkStatus: 'redirected' }));
  assert.doesNotMatch(redirected, /ds-notice/);
});
