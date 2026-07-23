/**
 * Confirms Stories v6 edition panel class hooks stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EDITION_ATMOSPHERE_CANVAS_CLASS } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';
import {
  STORIES_EDITION_MOSAIC_SEED,
  STORIES_EDITION_PANEL_CLASS,
  STORIES_EDITION_ROOT_CLASS,
  storiesEditionPanelClassName,
  storiesEditionRootClassName,
  storiesEditionStackClassName,
} from './stories-panel-chrome';

test('stories edition root includes shared atmosphere canvas class', () => {
  assert.equal(storiesEditionRootClassName(), `${STORIES_EDITION_ROOT_CLASS} ${EDITION_ATMOSPHERE_CANVAS_CLASS}`);
  assert.equal(STORIES_EDITION_ROOT_CLASS, 'ds-stories-edition');
});

test('stories edition panel class includes beat variant modifiers', () => {
  assert.equal(storiesEditionPanelClassName(), STORIES_EDITION_PANEL_CLASS);
  assert.equal(
    storiesEditionPanelClassName('catalog'),
    'ds-stories-edition__panel ds-stories-edition__panel--catalog',
  );
  assert.equal(
    storiesEditionPanelClassName('body'),
    'ds-stories-edition__panel ds-stories-edition__panel--body',
  );
});

test('stories edition stack and mosaic seed stay stable', () => {
  assert.equal(storiesEditionStackClassName(), 'ds-stories-edition__stack');
  assert.equal(STORIES_EDITION_MOSAIC_SEED, 'stories-edition-v6');
});
