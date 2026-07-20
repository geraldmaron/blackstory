/**
 * ConfidenceMark: Font Awesome icon + accessible label. Short visible word when
 * labeled; aria-label + title carry the full help phrase on hover.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import {
  ConfidenceMark,
  confidenceLabel,
  confidenceShortLabel,
} from './ConfidenceMark';

test('confidenceLabel defaults to the full phrase without a field title', () => {
  assert.equal(confidenceLabel('high'), 'high confidence');
  assert.equal(confidenceLabel('medium'), 'medium confidence');
  assert.equal(confidenceLabel('low'), 'low confidence');
  assert.equal(confidenceLabel('unrated'), 'Unrated');
});

test('confidenceLabel shortens when labeled=true (field title already present)', () => {
  assert.equal(confidenceLabel('high', true), 'High');
  assert.equal(confidenceLabel('medium', true), 'Medium');
  assert.equal(confidenceLabel('low', true), 'Low');
  assert.equal(confidenceLabel('unrated', true), 'Unrated');
  assert.equal(confidenceShortLabel('high'), 'High');
});

test('ConfidenceMark renders icon + short text when labeled', () => {
  const html = renderToStaticMarkup(createElement(ConfidenceMark, { tier: 'high', labeled: true }));
  assert.match(html, /data-labeled="true"/);
  assert.match(html, /ds-confidence-mark__icon/);
  assert.match(html, /aria-label="High confidence\. High confidence:/);
  assert.match(html, /title="High confidence:/);
  assert.match(html, /ds-confidence-mark__text">High</);
  // Visible word is short "High"; full phrase lives in aria-label + title.
  assert.match(html, /fa-circle-check/);
});

test('ConfidenceMark renders the full phrase when unlabeled', () => {
  const html = renderToStaticMarkup(createElement(ConfidenceMark, { tier: 'low' }));
  assert.match(html, /data-labeled="false"/);
  assert.match(html, /low confidence/);
  assert.match(html, /ds-confidence-mark__icon/);
});
