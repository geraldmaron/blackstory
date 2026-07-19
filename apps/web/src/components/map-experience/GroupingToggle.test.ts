/**
 * SSR markup smoke test for the nearby-points grouping toggle.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { GroupingToggle } from './GroupingToggle';

test('exposes aria-pressed reflecting the enabled state', () => {
  const onToggle = () => {};
  const on = renderToStaticMarkup(createElement(GroupingToggle, { enabled: true, onToggle }));
  const off = renderToStaticMarkup(createElement(GroupingToggle, { enabled: false, onToggle }));
  assert.match(on, /aria-pressed="true"/);
  assert.match(off, /aria-pressed="false"/);
  assert.match(on, /Group nearby: on/);
  assert.match(off, /Group nearby: off/);
});
