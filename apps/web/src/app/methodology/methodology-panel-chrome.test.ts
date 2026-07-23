/**
 * Confirms Methodology v6 edition panel class hooks stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  METHODOLOGY_EDITION_MOSAIC_SEED,
  METHODOLOGY_EDITION_PANEL_CLASS,
  METHODOLOGY_EDITION_ROOT_CLASS,
  methodologyEditionPanelClassName,
  methodologyEditionRootClassName,
  methodologyEditionStackClassName,
} from './methodology-panel-chrome';

test('methodology edition root class composes atmosphere canvas', () => {
  assert.equal(METHODOLOGY_EDITION_ROOT_CLASS, 'ds-methodology-edition');
  assert.match(methodologyEditionRootClassName(), /ds-methodology-edition/);
  assert.match(methodologyEditionRootClassName(), /ds-edition-atmosphere-canvas/);
});

test('methodology edition panel class includes beat variant modifiers', () => {
  assert.equal(methodologyEditionPanelClassName(), METHODOLOGY_EDITION_PANEL_CLASS);
  assert.equal(
    methodologyEditionPanelClassName('intro'),
    'ds-methodology-edition__panel ds-methodology-edition__panel--intro',
  );
  assert.equal(
    methodologyEditionPanelClassName('standards'),
    'ds-methodology-edition__panel ds-methodology-edition__panel--standards',
  );
});

test('methodology mosaic seed is route-specific', () => {
  assert.equal(METHODOLOGY_EDITION_MOSAIC_SEED, 'methodology-edition-v6');
  assert.equal(methodologyEditionStackClassName(), 'ds-methodology-edition__stack');
});
