/**
 * Confirms Law v6 edition panel class hooks stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LAW_EDITION_MOSAIC_SEED,
  LAW_EDITION_PANEL_CLASS,
  LAW_EDITION_ROOT_CLASS,
  lawEditionPanelClassName,
  lawEditionRootClassName,
  lawEditionStackClassName,
} from './law-panel-chrome';

test('law edition root class composes atmosphere canvas', () => {
  assert.equal(LAW_EDITION_ROOT_CLASS, 'ds-law-edition');
  assert.match(lawEditionRootClassName(), /ds-law-edition/);
  assert.match(lawEditionRootClassName(), /ds-edition-atmosphere-canvas/);
});

test('law edition panel class includes beat variant modifiers', () => {
  assert.equal(lawEditionPanelClassName(), LAW_EDITION_PANEL_CLASS);
  assert.equal(
    lawEditionPanelClassName('intro'),
    'ds-law-edition__panel ds-law-edition__panel--intro',
  );
  assert.equal(
    lawEditionPanelClassName('browse'),
    'ds-law-edition__panel ds-law-edition__panel--browse',
  );
});

test('law mosaic seed is route-specific', () => {
  assert.equal(LAW_EDITION_MOSAIC_SEED, 'law-edition-v6');
  assert.equal(lawEditionStackClassName(), 'ds-law-edition__stack');
});
