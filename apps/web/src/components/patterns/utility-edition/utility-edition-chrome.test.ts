/**
 * Utility v6 edition chrome: class-name contract for compact public pages.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  UTILITY_EDITION_ROOT_CLASS,
  utilityEditionPanelClassName,
  utilityEditionRootClassName,
  utilityEditionStackClassName,
} from './utility-edition-chrome';

const here = dirname(fileURLToPath(import.meta.url));
const cssSource = readFileSync(join(here, 'utility-edition.css'), 'utf8');

test('utility edition root pairs atmosphere canvas with edition root class', () => {
  assert.match(utilityEditionRootClassName(), new RegExp(UTILITY_EDITION_ROOT_CLASS));
  assert.match(utilityEditionRootClassName(), /ds-edition-atmosphere-canvas/);
});

test('utility edition stack and panel variants are stable', () => {
  assert.equal(utilityEditionStackClassName(), 'ds-utility-edition__stack');
  assert.equal(utilityEditionPanelClassName(), 'ds-utility-edition__panel');
  assert.equal(
    utilityEditionPanelClassName('intro'),
    'ds-utility-edition__panel ds-utility-edition__panel--intro',
  );
});

test('utility edition css imports atmosphere and defines focus-visible rings', () => {
  assert.match(cssSource, /@import '\.\.\/edition-atmosphere\/edition-atmosphere\.css'/);
  assert.match(cssSource, /:focus-visible/);
  assert.match(cssSource, /scroll-margin-top:\s*var\(--ds-island-clearance\)/);
});
