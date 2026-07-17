/**
 * SSR markup smoke test for DegradedModeNotice (BB-048/BB-022): confirms the
 * `PUBLIC_READ_API_DISABLED` env flag actually drives visible shell markup,
 * closing the gap where `isPublicReadApiDisabled()` had no caller anywhere in apps/web.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { DegradedModeNotice } from './DegradedModeNotice';

test('DegradedModeNotice renders nothing when live reads are not disabled', () => {
  const prior = process.env.PUBLIC_READ_API_DISABLED;
  delete process.env.PUBLIC_READ_API_DISABLED;
  const html = renderToStaticMarkup(createElement(DegradedModeNotice));
  assert.equal(html, '');
  process.env.PUBLIC_READ_API_DISABLED = prior;
});

test('DegradedModeNotice renders a snapshot-mode warning when PUBLIC_READ_API_DISABLED=1', () => {
  const prior = process.env.PUBLIC_READ_API_DISABLED;
  process.env.PUBLIC_READ_API_DISABLED = '1';
  const html = renderToStaticMarkup(createElement(DegradedModeNotice));
  assert.match(html, /role="status"/);
  assert.match(html, /Showing snapshot data/);
  assert.match(html, /last published/);
  process.env.PUBLIC_READ_API_DISABLED = prior;
});
