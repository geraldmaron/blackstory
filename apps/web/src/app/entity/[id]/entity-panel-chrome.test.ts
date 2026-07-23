/**
 * Confirms Entity v6 edition panel class hooks stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ENTITY_EDITION_MOSAIC_SEED,
  ENTITY_EDITION_PANEL_CLASS,
  ENTITY_EDITION_ROOT_CLASS,
  entityEditionMosaicSeedFor,
  entityEditionPanelClassName,
  entityEditionRootClassName,
  entityEditionStackClassName,
} from './entity-panel-chrome';

test('entity edition root class composes atmosphere canvas', () => {
  assert.equal(ENTITY_EDITION_ROOT_CLASS, 'ds-entity-edition');
  assert.match(entityEditionRootClassName(), /ds-entity-edition/);
  assert.match(entityEditionRootClassName(), /ds-edition-atmosphere-canvas/);
});

test('entity edition panel class includes beat variant modifiers', () => {
  assert.equal(entityEditionPanelClassName(), ENTITY_EDITION_PANEL_CLASS);
  assert.equal(
    entityEditionPanelClassName('intro'),
    'ds-entity-edition__panel ds-entity-edition__panel--intro',
  );
  assert.equal(
    entityEditionPanelClassName('anatomy'),
    'ds-entity-edition__panel ds-entity-edition__panel--anatomy',
  );
});

test('entity mosaic seed is per-record on detail', () => {
  assert.equal(ENTITY_EDITION_MOSAIC_SEED, 'entity-edition-v6');
  assert.equal(entityEditionMosaicSeedFor('ent_test_001'), 'entity-edition-v6:ent_test_001');
  assert.equal(entityEditionStackClassName(), 'ds-entity-edition__stack');
});
