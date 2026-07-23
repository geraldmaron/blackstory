/**
 * Confirms Data v6 edition panel class hooks stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DATA_EDITION_MOSAIC_SEED,
  DATA_EDITION_PANEL_CLASS,
  DATA_EDITION_ROOT_CLASS,
  dataEditionPanelClassName,
  dataEditionRootClassName,
  dataEditionStackClassName,
} from './data-panel-chrome';

test('data edition root class composes atmosphere canvas', () => {
  assert.equal(DATA_EDITION_ROOT_CLASS, 'ds-data-edition');
  assert.match(dataEditionRootClassName(), /ds-data-edition/);
  assert.match(dataEditionRootClassName(), /ds-edition-atmosphere-canvas/);
});

test('data edition panel class includes beat variant modifiers', () => {
  assert.equal(dataEditionPanelClassName(), DATA_EDITION_PANEL_CLASS);
  assert.equal(
    dataEditionPanelClassName('intro'),
    'ds-data-edition__panel ds-data-edition__panel--intro',
  );
  assert.equal(
    dataEditionPanelClassName('population'),
    'ds-data-edition__panel ds-data-edition__panel--population',
  );
});

test('data mosaic seed is route-specific', () => {
  assert.equal(DATA_EDITION_MOSAIC_SEED, 'data-edition-v6');
  assert.equal(dataEditionStackClassName(), 'ds-data-edition__stack');
});
