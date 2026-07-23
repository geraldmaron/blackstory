/**
 * Confirms Books v6 edition panel class hooks stay stable for CSS and a11y.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EDITION_ATMOSPHERE_CANVAS_CLASS } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';
import {
  BOOKS_EDITION_MOSAIC_SEED,
  BOOKS_EDITION_PANEL_CLASS,
  BOOKS_EDITION_ROOT_CLASS,
  booksEditionPanelClassName,
  booksEditionRootClassName,
  booksEditionStackClassName,
} from './books-panel-chrome';

test('books edition root includes shared atmosphere canvas class', () => {
  assert.equal(
    booksEditionRootClassName(),
    `${BOOKS_EDITION_ROOT_CLASS} ${EDITION_ATMOSPHERE_CANVAS_CLASS}`,
  );
  assert.equal(BOOKS_EDITION_ROOT_CLASS, 'ds-books-edition');
});

test('books edition panel class includes beat variant modifiers', () => {
  assert.equal(booksEditionPanelClassName(), BOOKS_EDITION_PANEL_CLASS);
  assert.equal(
    booksEditionPanelClassName('catalog'),
    'ds-books-edition__panel ds-books-edition__panel--catalog',
  );
  assert.equal(
    booksEditionPanelClassName('context'),
    'ds-books-edition__panel ds-books-edition__panel--context',
  );
});

test('books edition stack and mosaic seed stay stable', () => {
  assert.equal(booksEditionStackClassName(), 'ds-books-edition__stack');
  assert.equal(BOOKS_EDITION_MOSAIC_SEED, 'books-edition-v6');
});
