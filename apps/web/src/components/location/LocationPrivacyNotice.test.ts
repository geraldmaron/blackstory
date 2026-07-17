/**
 * SSR markup smoke test for LocationPrivacyNotice (BB-050) — proves the privacy disclosure
 * (explicit consent, translate-then-discard, no history, manual fallback) is real rendered
 * markup, not just a design note. Pattern follows `../DegradedModeNotice.test.ts`.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { LocationPrivacyNotice } from './LocationPrivacyNotice';

test('renders a status/warning notice explaining explicit consent and no stored history', () => {
  const html = renderToStaticMarkup(createElement(LocationPrivacyNotice));
  assert.match(html, /role="status"/);
  assert.match(html, /press the button below/);
  assert.match(html, /discarded immediately/);
  assert.match(html, /stored history of your searches/);
});

test('mentions the 50-states-+-D.C. scope and the manual search fallback', () => {
  const html = renderToStaticMarkup(createElement(LocationPrivacyNotice));
  assert.match(html, /50 states and D\.C\./);
  assert.match(html, /search by place name/);
});
