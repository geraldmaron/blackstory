/**
 * Confirms About v6 edition panel class hooks stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ABOUT_EDITION_MOSAIC_SEED,
  ABOUT_EDITION_PANEL_CLASS,
  ABOUT_EDITION_ROOT_CLASS,
  aboutEditionPanelClassName,
  aboutEditionRootClassName,
  aboutEditionStackClassName,
} from './about-panel-chrome';

test('about edition root class composes atmosphere canvas', () => {
  assert.equal(ABOUT_EDITION_ROOT_CLASS, 'ds-about-edition');
  assert.match(aboutEditionRootClassName(), /ds-about-edition/);
  assert.match(aboutEditionRootClassName(), /ds-edition-atmosphere-canvas/);
});

test('about edition panel class includes beat variant modifiers', () => {
  assert.equal(aboutEditionPanelClassName(), ABOUT_EDITION_PANEL_CLASS);
  assert.equal(
    aboutEditionPanelClassName('intro'),
    'ds-about-edition__panel ds-about-edition__panel--intro',
  );
  assert.equal(
    aboutEditionPanelClassName('publish'),
    'ds-about-edition__panel ds-about-edition__panel--publish',
  );
});

test('about mosaic seed is route-specific', () => {
  assert.equal(ABOUT_EDITION_MOSAIC_SEED, 'about-edition-v6');
  assert.equal(aboutEditionStackClassName(), 'ds-about-edition__stack');
});
