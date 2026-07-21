/**
 * SSR markup smoke tests for entity session navigation controls.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { EntitySessionNav } from './EntitySessionNav';

const noop = () => {};

test('renders labeled back, next, and random toggle with disabled and pressed states', () => {
  const html = renderToStaticMarkup(
    createElement(EntitySessionNav, {
      canBack: false,
      canNext: true,
      randomEnabled: true,
      onBack: noop,
      onNext: noop,
      onRandomToggle: noop,
    }),
  );

  assert.match(html, /aria-label="Record navigation"/);
  assert.match(html, /aria-label="Back to previous record"/);
  assert.match(html, /disabled/);
  assert.match(html, /aria-label="Next random record"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Random: on/);
  assert.match(html, />Back</);
  assert.match(html, />Next</);
});

test('sequential next exposes list-oriented label when random is off', () => {
  const html = renderToStaticMarkup(
    createElement(EntitySessionNav, {
      canBack: true,
      canNext: false,
      randomEnabled: false,
      onBack: noop,
      onNext: noop,
      onRandomToggle: noop,
    }),
  );

  assert.match(html, /aria-label="Next record in list"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /Random: off/);
  assert.doesNotMatch(html, /aria-label="Next random record"/);
});
