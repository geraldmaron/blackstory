/**
 * Pure class-name helpers for Books v6 edition panels: Surface card stack, beat
 * variants, and shared atmosphere canvas hooks. Keeps page JSX readable and gives
 * tests a stable contract for CSS and a11y.
 */

import { editionAtmosphereCanvasClassName } from '../../components/patterns/edition-atmosphere/edition-atmosphere-canvas';

/** Mosaic seed for books routes (browse index and detail). */
export const BOOKS_EDITION_MOSAIC_SEED = 'books-edition-v6';

/** Root wrapper on books routes — pairs with books-edition.css. */
export const BOOKS_EDITION_ROOT_CLASS = 'ds-books-edition';

/** Default Surface edition panel. */
export const BOOKS_EDITION_PANEL_CLASS = 'ds-books-edition__panel';

export type BooksEditionPanelVariant =
  | 'intro'
  | 'catalog'
  | 'about'
  | 'context'
  | 'challenges'
  | 'evidence'
  | 'related'
  | 'place'
  | 'connected'
  | 'provenance';

export function booksEditionRootClassName(): string {
  return `${BOOKS_EDITION_ROOT_CLASS} ${editionAtmosphereCanvasClassName()}`;
}

export function booksEditionStackClassName(): string {
  return 'ds-books-edition__stack';
}

export function booksEditionPanelClassName(variant?: BooksEditionPanelVariant): string {
  if (!variant) {
    return BOOKS_EDITION_PANEL_CLASS;
  }
  return `${BOOKS_EDITION_PANEL_CLASS} ds-books-edition__panel--${variant}`;
}
