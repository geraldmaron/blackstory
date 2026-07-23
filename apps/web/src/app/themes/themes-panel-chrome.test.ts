/**
 * Confirms Themes v6 edition panel class hooks stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EDITION_ATMOSPHERE_CANVAS_CLASS } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';
import {
  THEMES_EDITION_MOSAIC_SEED,
  THEMES_EDITION_PANEL_CLASS,
  THEMES_EDITION_ROOT_CLASS,
  themesEditionMosaicSeedForTheme,
  themesEditionPanelClassName,
  themesEditionRootClassName,
  themesEditionStackClassName,
} from './themes-panel-chrome';

test('themes edition root includes shared atmosphere canvas class', () => {
  assert.equal(
    themesEditionRootClassName(),
    `${THEMES_EDITION_ROOT_CLASS} ${EDITION_ATMOSPHERE_CANVAS_CLASS}`,
  );
  assert.equal(THEMES_EDITION_ROOT_CLASS, 'ds-themes-edition');
});

test('themes edition panel class includes beat variant modifiers', () => {
  assert.equal(themesEditionPanelClassName(), THEMES_EDITION_PANEL_CLASS);
  assert.equal(
    themesEditionPanelClassName('catalog'),
    'ds-themes-edition__panel ds-themes-edition__panel--catalog',
  );
  assert.equal(
    themesEditionPanelClassName('packets'),
    'ds-themes-edition__panel ds-themes-edition__panel--packets',
  );
});

test('themes edition stack and mosaic seeds stay stable', () => {
  assert.equal(themesEditionStackClassName(), 'ds-themes-edition__stack');
  assert.equal(THEMES_EDITION_MOSAIC_SEED, 'themes-edition-v6');
  assert.equal(themesEditionMosaicSeedForTheme('redlining'), 'themes-edition-v6:redlining');
});
